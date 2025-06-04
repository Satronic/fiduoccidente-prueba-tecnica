import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb"; // Usaremos Scan por simplicidad para la prueba

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const approversTableName = process.env.APPROVERS_TABLE_NAME;
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"; // URL por defecto

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    if (!approversTableName) {
        console.error("Error: APPROVERS_TABLE_NAME no definida en variables de entorno.");
        return { 
            statusCode: 500, 
            body: JSON.stringify({ message: "Error de configuración interna del servidor." }), 
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
        };
    }

    console.log("Evento recibido para mockMail:", JSON.stringify(event, null, 2));

    try {
        // Escaneamos la tabla de aprobadores para obtener todos los registros.
        // ADVERTENCIA: En una aplicación de producción con muchos datos, Scan es ineficiente y costoso.
        // Se preferiría una consulta a un GSI si se necesitaran filtros (ej. por fecha de creación).
        // Para esta prueba técnica con datos limitados, un Scan es aceptable para simplificar.
        const scanResult = await ddbDocClient.send(new ScanCommand({
            TableName: approversTableName,
            // Podrías añadir FilterExpression si solo quieres los que tienen un token, etc.
            // ProjectionExpression para traer solo los campos necesarios: requestId, approverEmail, approverToken
            ProjectionExpression: "requestId, approverEmail, approverToken"
        }));

        const mockEmails = (scanResult.Items || []).map(item => {
            const purchaseRequestId = item.requestId;
            const approverToken = item.approverToken;
            const approverEmail = item.approverEmail;

            // Construir el link de aprobación
            // Asegurarse que la ruta del frontend sea /approve y que los query params sean los correctos
            //const approvalLink = `<span class="math-inline">\{frontendUrl\}/approve?purchase\_request\_id\=</span>{purchaseRequestId}&approver_token=${approverToken}`;

            return {
                approverEmail: approverEmail,
                purchaseRequestId: purchaseRequestId,
                approverToken: approverToken, // Incluido para facilitar la identificación del token
                //approvalLink: approvalLink,
                // Podrías añadir un "asunto" y "cuerpo" simulado si quisieras
                //subject: `Acción Requerida: Aprobación de Solicitud de Compra ${purchaseRequestId.substring(0,8)}...`,
                //body: `Estimado(a) Aprobador(a),\n\nSe requiere su aprobación para la solicitud de compra <span class="math-inline">\{purchaseRequestId\}\.\\nPor favor, acceda al siguiente link para revisar y tomar una decisión\:\\n</span>{approvalLink}\n\nGracias.`
            };
        });

        return {
            statusCode: 200,
            body: JSON.stringify(mockEmails),
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*" // Ajustar en producción
            },
        };

    } catch (dbError) {
        const error = dbError as Error;
        console.error("Error interactuando con DynamoDB en mockMail:", error.message, error.stack);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ message: "Error al obtener los datos para los correos simulados.", error: error.message }), 
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
        };
    }
};