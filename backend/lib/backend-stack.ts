import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class BackendStack extends cdk.Stack {
  public readonly purchaseRequestsTable: dynamodb.Table;
  public readonly approversTable: dynamodb.Table;
  public readonly evidenceBucket: s3.Bucket;
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const environment = this.node.tryGetContext('environment') ?? 'dev';
    const isProdLikeEnvironment = environment === 'prod' || environment === 'evaluation';

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
        FRONTEND_URL: isProdLikeEnvironment ? "https://PENDING_FRONTEND_URL.com" : "http://localhost:3001",
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

    // --- Recurso para una Solicitud de Compra Específica ---
    const singlePurchaseRequestResource = purchaseRequestsResource.addResource('{purchaseRequestId}');

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
    singlePurchaseRequestResource.addMethod('GET', new apigateway.LambdaIntegration(getPurchaseRequestByIdFunction));

    // --- 7. Función Lambda para Iniciar Aprobación (GET /purchase-requests/approve) ---
    const getApprovalInfoFunction = new NodejsFunction(this, 'GetApprovalInfoFunction', {
        functionName: `GetApprovalInfoFunction-${environment}`,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: path.join(__dirname, '../src/handlers/approvals/getApprovalInfo.ts'),
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
    this.purchaseRequestsTable.grantReadData(getApprovalInfoFunction);
    this.approversTable.grantReadWriteData(getApprovalInfoFunction); // Necesita escribir el OTP
    const approveResource = purchaseRequestsResource.addResource('approve'); 
    approveResource.addMethod('GET', new apigateway.LambdaIntegration(getApprovalInfoFunction), {
        authorizationType: apigateway.AuthorizationType.NONE, 
        requestParameters: { 
            'method.request.querystring.purchase_request_id': true,
            'method.request.querystring.approver_token': true
        },
    });
    
    // --- 8. Función Lambda para Validar OTP (POST /purchase-requests/{purchaseRequestId}/validate-otp) ---
    const validateOtpFunction = new NodejsFunction(this, 'ValidateOtpFunction', {
        functionName: `ValidateOtpFunction-${environment}`,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: path.join(__dirname, '../src/handlers/approvals/validateOtp.ts'),
        handler: 'handler',
        bundling: {
            minify: isProdLikeEnvironment,
            sourceMap: !isProdLikeEnvironment,
        },
        environment: {
            APPROVERS_TABLE_NAME: this.approversTable.tableName,
            ENVIRONMENT: environment,
        },
        timeout: cdk.Duration.seconds(10),
        memorySize: 128, 
    });
    this.approversTable.grantReadWriteData(validateOtpFunction);
    const validateOtpResource = singlePurchaseRequestResource.addResource('validate-otp');
    validateOtpResource.addMethod('POST', new apigateway.LambdaIntegration(validateOtpFunction), {
        authorizationType: apigateway.AuthorizationType.NONE, 
    });

    // --- 9. NUEVO: Función Lambda para Registrar Decisión (POST /purchase-requests/{purchaseRequestId}/decision) ---
    const submitDecisionFunction = new NodejsFunction(this, 'SubmitDecisionFunction', {
        functionName: `SubmitDecisionFunction-${environment}`,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: path.join(__dirname, '../src/handlers/approvals/submitDecision.ts'), // Asegúrate que esta ruta sea correcta
        handler: 'handler',
        bundling: {
            minify: isProdLikeEnvironment,
            sourceMap: !isProdLikeEnvironment,
        },
        environment: {
            PURCHASE_REQUESTS_TABLE_NAME: this.purchaseRequestsTable.tableName, // Necesaria para actualizar estado general
            APPROVERS_TABLE_NAME: this.approversTable.tableName,
            ENVIRONMENT: environment,
        },
        timeout: cdk.Duration.seconds(15), // Puede requerir un poco más por múltiples escrituras
        memorySize: 256, 
    });

    // Permisos para la función SubmitDecisionFunction
    this.purchaseRequestsTable.grantReadWriteData(submitDecisionFunction); // Para actualizar el estado general de la solicitud
    this.approversTable.grantReadWriteData(submitDecisionFunction); // Para actualizar el estado del aprobador y leer otros

    // Nuevo método en API Gateway bajo el recurso con path parameter
    // singlePurchaseRequestResource es /purchase-requests/{purchaseRequestId}
    const decisionResource = singlePurchaseRequestResource.addResource('decision'); // Crea /purchase-requests/{purchaseRequestId}/decision
    decisionResource.addMethod('POST', new apigateway.LambdaIntegration(submitDecisionFunction), {
        authorizationType: apigateway.AuthorizationType.NONE, 
        // Aquí podrías añadir un request validator para el cuerpo del POST si lo defines en OpenAPI
    });

    // --- Outputs ---
    new cdk.CfnOutput(this, 'EnvironmentDeployed', { value: environment });
    new cdk.CfnOutput(this, 'PurchaseRequestsTableNameOutput', { value: this.purchaseRequestsTable.tableName });
    new cdk.CfnOutput(this, 'ApproversTableNameOutput', { value: this.approversTable.tableName });
    new cdk.CfnOutput(this, 'EvidenceBucketNameOutput', { value: this.evidenceBucket.bucketName });
    new cdk.CfnOutput(this, 'ApiBaseUrlOutput', { value: this.api.url });
    new cdk.CfnOutput(this, 'ListAndCreatePurchaseRequestsEndpoint', { value: this.api.urlForPath(purchaseRequestsResource.path) });
    new cdk.CfnOutput(this, 'GetPurchaseRequestByIdBaseEndpoint', { value: `${this.api.urlForPath(purchaseRequestsResource.path)}/{purchaseRequestId}` });
    new cdk.CfnOutput(this, 'GetApprovalInfoEndpoint', { value: `${this.api.urlForPath(approveResource.path)}?purchase_request_id={purchaseRequestIdValue}&approver_token={approverTokenValue}`});
    new cdk.CfnOutput(this, 'ValidateOtpEndpointBase', { value: `${this.api.urlForPath(singlePurchaseRequestResource.path)}/validate-otp`.replace('{purchaseRequestId}', '{YOUR_REQUEST_ID}') });
    // Nuevo Output para el endpoint de decisión
    new cdk.CfnOutput(this, 'SubmitDecisionEndpointBase', { 
        value: `${this.api.urlForPath(singlePurchaseRequestResource.path)}/decision`.replace('{purchaseRequestId}', '{YOUR_REQUEST_ID}'),
        description: `Endpoint base para POST /purchase-requests/{purchaseRequestId}/decision (reemplaza {YOUR_REQUEST_ID})`
    });
  }
}