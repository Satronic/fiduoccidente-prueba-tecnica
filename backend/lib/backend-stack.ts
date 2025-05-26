import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'; // Importar NodejsFunction
import * as lambda from 'aws-cdk-lib/aws-lambda'; // Para Runtime, Duration, etc.
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam'; // Importar iam para políticas granulares si es necesario
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
      pointInTimeRecovery: isProdLikeEnvironment,
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
      pointInTimeRecovery: isProdLikeEnvironment,
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
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: [
          'Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key',
          'X-Amz-Security-Token', 'X-Requester-Email', 'X-Approver-Token'
        ],
      },
      deployOptions: {
        stageName: environment,
      },
    });

    // --- Recurso Raíz para Solicitudes de Compra ---
    const purchaseRequestsResource = this.api.root.addResource('purchase-requests');

    // --- 4. Función Lambda para Crear Solicitudes ---
    const createPurchaseRequestFunction = new NodejsFunction(this, 'CreatePurchaseRequestFunction', {
      functionName: `CreatePurchaseRequestFunction-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/handlers/purchaseRequests/createRequest.ts'),
      handler: 'handler',
      bundling: {
        minify: isProdLikeEnvironment,
        sourceMap: !isProdLikeEnvironment,
      },
      environment: {
        PURCHASE_REQUESTS_TABLE_NAME: this.purchaseRequestsTable.tableName,
        APPROVERS_TABLE_NAME: this.approversTable.tableName,
        ENVIRONMENT: environment,
        FRONTEND_URL: isProdLikeEnvironment ? "https://TU_URL_FRONTEND_PROD_EVAL.com" : "http://localhost:3001",
      },
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
    });
    this.purchaseRequestsTable.grantReadWriteData(createPurchaseRequestFunction);
    this.approversTable.grantReadWriteData(createPurchaseRequestFunction);
    purchaseRequestsResource.addMethod('POST', new apigateway.LambdaIntegration(createPurchaseRequestFunction));

    // --- 5. Función Lambda para Listar Solicitudes del Usuario ---
    const listUserRequestsFunction = new NodejsFunction(this, 'ListUserRequestsFunction', {
        functionName: `ListUserRequestsFunction-${environment}`,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: path.join(__dirname, '../src/handlers/purchaseRequests/listUserRequests.ts'),
        handler: 'handler',
        bundling: {
            minify: isProdLikeEnvironment,
            sourceMap: !isProdLikeEnvironment,
        },
        environment: {
            PURCHASE_REQUESTS_TABLE_NAME: this.purchaseRequestsTable.tableName,
            ENVIRONMENT: environment,
        },
        timeout: cdk.Duration.seconds(10),
        memorySize: 256,
    });
    this.purchaseRequestsTable.grantReadData(listUserRequestsFunction);
    purchaseRequestsResource.addMethod('GET', new apigateway.LambdaIntegration(listUserRequestsFunction));

    // --- 6. Función Lambda para Obtener Detalle de Solicitud ---
    const getPurchaseRequestByIdFunction = new NodejsFunction(this, 'GetPurchaseRequestByIdFunction', {
        functionName: `GetPurchaseRequestByIdFunction-${environment}`,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: path.join(__dirname, '../src/handlers/purchaseRequests/getRequestById.ts'),
        handler: 'handler',
        bundling: {
            minify: isProdLikeEnvironment,
            sourceMap: !isProdLikeEnvironment,
        },
        environment: {
            PURCHASE_REQUESTS_TABLE_NAME: this.purchaseRequestsTable.tableName,
            APPROVERS_TABLE_NAME: this.approversTable.tableName,
            ENVIRONMENT: environment,
        },
        timeout: cdk.Duration.seconds(10),
        memorySize: 256, 
    });
    this.purchaseRequestsTable.grantReadData(getPurchaseRequestByIdFunction);
    this.approversTable.grantReadData(getPurchaseRequestByIdFunction);
    const singlePurchaseRequestResource = purchaseRequestsResource.addResource('{purchaseRequestId}');
    singlePurchaseRequestResource.addMethod('GET', new apigateway.LambdaIntegration(getPurchaseRequestByIdFunction));

    // --- 7. Función Lambda para Iniciar Aprobación (GET /purchase-requests/approve) ---
    const getApprovalInfoFunction = new NodejsFunction(this, 'GetApprovalInfoFunction', {
        functionName: `GetApprovalInfoFunction-${environment}`,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: path.join(__dirname, '../src/handlers/approvals/getApprovalInfo.ts'), // Nueva ruta al handler de aprobación
        handler: 'handler',
        bundling: {
            minify: isProdLikeEnvironment,
            sourceMap: !isProdLikeEnvironment,
        },
        environment: {
            PURCHASE_REQUESTS_TABLE_NAME: this.purchaseRequestsTable.tableName,
            APPROVERS_TABLE_NAME: this.approversTable.tableName, // Necesaria para leer y actualizar el aprobador con OTP
            ENVIRONMENT: environment,
        },
        timeout: cdk.Duration.seconds(10),
        memorySize: 256, 
    });

    // Permisos para la función GetApprovalInfoFunction
    this.purchaseRequestsTable.grantReadData(getApprovalInfoFunction); // Para leer los detalles de la solicitud
    this.approversTable.grantReadWriteData(getApprovalInfoFunction); // Para leer el aprobador por token y actualizar con OTP/estado

    // Nuevo recurso y método en API Gateway para /purchase-requests/approve
    const approveResource = purchaseRequestsResource.addResource('approve'); 
    approveResource.addMethod('GET', new apigateway.LambdaIntegration(getApprovalInfoFunction), {
        authorizationType: apigateway.AuthorizationType.NONE, 
        requestParameters: { // Definir los query string parameters esperados
            'method.request.querystring.purchase_request_id': true, // true = requerido
            'method.request.querystring.approver_token': true
        },
        // Si necesitas un request validator para los query params:
        // requestValidator: new apigateway.RequestValidator(this, `ApproveQueryValidator-${environment}`, {
        //   restApi: this.api,
        //   validateRequestParameters: true,
        // }),
    });
    
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
    new cdk.CfnOutput(this, 'ApiBaseUrlOutput', {
      value: this.api.url, 
      description: `URL Base para API Gateway (stage ${environment})`,
    });
    new cdk.CfnOutput(this, 'ListAndCreatePurchaseRequestsEndpoint', { 
        value: this.api.urlForPath(purchaseRequestsResource.path),
        description: `Endpoint URL para GET y POST /purchase-requests (stage ${environment})`
    });
    new cdk.CfnOutput(this, 'GetPurchaseRequestByIdBaseEndpoint', { 
        value: `${this.api.urlForPath(purchaseRequestsResource.path)}/{purchaseRequestId}`,
        description: `Endpoint base para GET /purchase-requests/{purchaseRequestId} (reemplaza {purchaseRequestId})`
    });
    new cdk.CfnOutput(this, 'GetApprovalInfoEndpoint', { 
        value: `${this.api.urlForPath(approveResource.path)}?purchase_request_id={purchaseRequestIdValue}&approver_token={approverTokenValue}`,
        description: `Endpoint para GET /purchase-requests/approve (reemplaza los valores en query string)`
    });
  }
}