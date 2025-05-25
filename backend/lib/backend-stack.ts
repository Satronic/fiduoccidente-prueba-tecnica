import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
// Importa 'path' si vas a definir Lambdas aquí y necesitas construir rutas a su código.
// import * as path from 'path';

// Asegúrate que el nombre de la clase coincida con el que usas en tu archivo bin/xxxx.ts
export class BackendStack extends cdk.Stack {
  // Propiedades públicas para que los recursos sean accesibles si se necesitan en otros stacks
  // o para pasar sus nombres a las Lambdas como variables de entorno.
  public readonly purchaseRequestsTable: dynamodb.Table;
  public readonly approversTable: dynamodb.Table;
  public readonly evidenceBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- Detección de Ambiente ---
    // Lee la variable de contexto 'environment'.
    // Si no se pasa (-c environment=nombre_ambiente) al ejecutar cdk deploy/synth,
    // usará el valor de 'context.environment' en cdk.json, o 'dev' como valor por defecto si no está en cdk.json.
    const environment = this.node.tryGetContext('environment') ?? 'dev';

    // Determinar si el ambiente es de tipo producción (para la evaluación, consideraremos 'evaluation' como producción)
    const isProdLikeEnvironment = environment === 'prod' || environment === 'evaluation';

    // --- Configuraciones Basadas en el Ambiente ---
    const dynamoDbRemovalPolicy = isProdLikeEnvironment ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;
    // Para S3, si es RETAIN, autoDeleteObjects no se aplica o se ignora.
    // Si fuera DESTROY (para dev), autoDeleteObjects: true es útil.
    const s3RemovalPolicy = isProdLikeEnvironment ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;
    const s3AutoDeleteObjects = !isProdLikeEnvironment; // Habilitar solo si removalPolicy es DESTROY
    const s3BucketVersioning = isProdLikeEnvironment; // Habilitar versionado para ambientes tipo producción

    // --- 1. Definición de Tablas DynamoDB ---
    this.purchaseRequestsTable = new dynamodb.Table(this, 'PurchaseRequestsTable', {
      // Usar el nombre del ambiente en el nombre de la tabla para evitar colisiones entre ambientes
      tableName: `PurchaseRequestsTable-${environment}`,
      partitionKey: { name: 'requestId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: dynamoDbRemovalPolicy, // Política de eliminación basada en el ambiente
      // pointInTimeRecovery: isProdLikeEnvironment, // Habilitar PITR para ambientes tipo producción
    });

    this.purchaseRequestsTable.addGlobalSecondaryIndex({
      indexName: 'RequesterEmailIndex',
      partitionKey: { name: 'requesterEmail', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING }, // o NUMBER si usas Epoch
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.approversTable = new dynamodb.Table(this, 'ApproversTable', {
      tableName: `ApproversTable-${environment}`, // Nombre de tabla por ambiente
      partitionKey: { name: 'requestId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'approverEmail', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: dynamoDbRemovalPolicy, // Política de eliminación basada en el ambiente
      // pointInTimeRecovery: isProdLikeEnvironment, // Habilitar PITR para ambientes tipo producción
    });

    this.approversTable.addGlobalSecondaryIndex({
      indexName: 'ApproverTokenIndex',
      partitionKey: { name: 'approverToken', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- 2. Definición de Bucket S3 ---
    // Nombre de bucket único globalmente, incluyendo el ambiente
    const bucketName = `fiduoccidente-evidencias-${environment}-${this.account}-${this.region}`;
    this.evidenceBucket = new s3.Bucket(this, 'EvidenceBucket', {
      bucketName: bucketName,
      removalPolicy: s3RemovalPolicy, // Política de eliminación basada en el ambiente
      // autoDeleteObjects solo tiene efecto si removalPolicy es DESTROY.
      // Si es RETAIN, el bucket no se borra, por lo tanto los objetos tampoco.
      autoDeleteObjects: s3AutoDeleteObjects && !isProdLikeEnvironment ? true : undefined,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Siempre recomendado
      encryption: s3.BucketEncryption.S3_MANAGED, // Encriptación por defecto S3
      versioned: s3BucketVersioning, // Versionado basado en el ambiente
      // lifecycleRules: [...] // Podrías añadir reglas de ciclo de vida para producción
    });

    // --- Outputs (para referencia fácil después del despliegue) ---
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
  }
}