import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'; // Importar NodejsFunction
import * as lambda from 'aws-cdk-lib/aws-lambda'; // Para Runtime, Duration, etc.
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';

// Asegúrate que el nombre de la clase coincida con el que usas en tu archivo bin/xxxx.ts
export class BackendStack extends cdk.Stack {
  public readonly purchaseRequestsTable: dynamodb.Table;
  public readonly approversTable: dynamodb.Table;
  public readonly evidenceBucket: s3.Bucket;
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- Detección de Ambiente ---
    const environment = this.node.tryGetContext('environment') ?? 'dev';
    const isProdLikeEnvironment = environment === 'prod' || environment === 'evaluation';

    // --- Configuraciones Basadas en el Ambiente ---
    const dynamoDbRemovalPolicy = isProdLikeEnvironment ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;
    const s3RemovalPolicy = isProdLikeEnvironment ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;
    const s3AutoDeleteObjects = !isProdLikeEnvironment;
    const s3BucketVersioning = isProdLikeEnvironment;

    // --- 1. Definición de Tablas DynamoDB ---
    this.purchaseRequestsTable = new dynamodb.Table(this, 'PurchaseRequestsTable', {
      tableName: `PurchaseRequestsTable-${environment}`,
      partitionKey: { name: 'requestId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: dynamoDbRemovalPolicy,
      pointInTimeRecovery: isProdLikeEnvironment, // Habilitar PITR para ambientes tipo producción
    });

    this.purchaseRequestsTable.addGlobalSecondaryIndex({
      indexName: 'RequesterEmailIndex',
      partitionKey: { name: 'requesterEmail', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.approversTable = new dynamodb.Table(this, 'ApproversTable', {
      tableName: `ApproversTable-${environment}`,
      partitionKey: { name: 'requestId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'approverEmail', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: dynamoDbRemovalPolicy,
      pointInTimeRecovery: isProdLikeEnvironment, // Habilitar PITR para ambientes tipo producción
    });

    this.approversTable.addGlobalSecondaryIndex({
      indexName: 'ApproverTokenIndex',
      partitionKey: { name: 'approverToken', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- 2. Definición de Bucket S3 ---
    const bucketName = `fiduoccidente-evidencias-${environment}-${this.account}-${this.region}`;
    this.evidenceBucket = new s3.Bucket(this, 'EvidenceBucket', {
      bucketName: bucketName,
      removalPolicy: s3RemovalPolicy,
      autoDeleteObjects: s3AutoDeleteObjects && !isProdLikeEnvironment ? true : undefined,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: s3BucketVersioning,
    });

    // --- 3. Definición de API Gateway ---
    this.api = new apigateway.RestApi(this, `FiduoccidenteApi-${environment}`, {
      restApiName: `Fiduoccidente Approval Flow API (${environment})`,
      description: `API para el flujo de aprobaciones - Ambiente: ${environment}`,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // Sé más específico en producción
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: [
          'Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key',
          'X-Amz-Security-Token', 'X-Requester-Email', 'X-Approver-Token'
        ],
      },
      deployOptions: {
        stageName: environment, // Crea un stage con el nombre del ambiente
      },
    });

    // --- 4. Definición de la Función Lambda para Crear Solicitudes ---
    const createPurchaseRequestFunction = new NodejsFunction(this, 'CreatePurchaseRequestFunction', {
      functionName: `CreatePurchaseRequestFunction-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X, // O la versión que prefieras (ej. NODEJS_20_X)
      entry: path.join(__dirname, '../src/handlers/purchaseRequests/createRequest.ts'), // Apunta al archivo .ts
      handler: 'handler', // Nombre de la función exportada en createRequest.ts
      bundling: {
        minify: isProdLikeEnvironment, // Minificar en producción/evaluación
        sourceMap: !isProdLikeEnvironment, // Generar source maps solo en desarrollo
      },
      environment: {
        PURCHASE_REQUESTS_TABLE_NAME: this.purchaseRequestsTable.tableName,
        APPROVERS_TABLE_NAME: this.approversTable.tableName,
        ENVIRONMENT: environment,
        FRONTEND_URL: isProdLikeEnvironment ? "https://TU_URL_FRONTEND_PROD_EVAL.com" : "http://localhost:3001", // Reemplaza la URL de prod/eval
      },
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
    });

    // --- 5: Función Lambda para Listar Solicitudes del Usuario (GET /purchase-requests) ---
    const listUserRequestsFunction = new NodejsFunction(this, 'ListUserRequestsFunction', {
        functionName: `ListUserRequestsFunction-${environment}`,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: path.join(__dirname, '../src/handlers/purchaseRequests/listUserRequests.ts'), // Apunta al nuevo archivo
        handler: 'handler',
        bundling: {
            minify: isProdLikeEnvironment,
            sourceMap: !isProdLikeEnvironment,
            externalModules: ['aws-sdk'], // Si usas SDK v2 global; si usas v3 empaquetado, puedes quitarla.
        },
        environment: {
            PURCHASE_REQUESTS_TABLE_NAME: this.purchaseRequestsTable.tableName,
            ENVIRONMENT: environment,
        },
        timeout: cdk.Duration.seconds(10),
        memorySize: 256, // Ajusta según necesidad, puede ser menos para una simple query.
    });

    // ---6. Otorgar permisos a la Lambda para escribir en las tablas DynamoDB
    this.purchaseRequestsTable.grantReadWriteData(createPurchaseRequestFunction);
    this.approversTable.grantReadWriteData(createPurchaseRequestFunction);

    // Otorgar permisos de lectura a la tabla PurchaseRequests (específicamente para el GSI)
    this.purchaseRequestsTable.grantReadData(listUserRequestsFunction)

    // --- 7. Integración de la Lambda con API Gateway ---
    const purchaseRequestsResource = this.api.root.addResource('purchase-requests');
    purchaseRequestsResource.addMethod('POST', new apigateway.LambdaIntegration(createPurchaseRequestFunction));

    // Añadir método GET a /purchase-requests
    purchaseRequestsResource.addMethod('GET', new apigateway.LambdaIntegration(listUserRequestsFunction));


    // --- Outputs ---
    new cdk.CfnOutput(this, 'EnvironmentDeployed', {
      value: environment,
      description: 'Ambiente desplegado actualmente.',
    });
    new cdk.CfnOutput(this, 'PurchaseRequestsTableNameOutput', {
      value: this.purchaseRequestsTable.tableName,
      description: 'Nombre de la tabla DynamoDB para Solicitudes de Compra.',
    });
    new cdk.CfnOutput(this, 'ApproversTableNameOutput', {
      value: this.approversTable.tableName,
      description: 'Nombre de la tabla DynamoDB para Aprobadores.',
    });
    new cdk.CfnOutput(this, 'EvidenceBucketNameOutput', {
      value: this.evidenceBucket.bucketName,
      description: 'Nombre del bucket S3 para las evidencias PDF.',
    });
    new cdk.CfnOutput(this, 'ApiEndpointOutput', {
      value: this.api.urlForPath(purchaseRequestsResource.path), // URL específica del recurso /purchase-requests
      description: `Endpoint URL para POST /purchase-requests en API Gateway (stage ${environment})`,
    });
    new cdk.CfnOutput(this, 'ApiBaseUrlOutput', {
      value: this.api.url, // URL base de la API (incluye el stage)
      description: `URL Base para API Gateway (stage ${environment})`,
    });
  }
}