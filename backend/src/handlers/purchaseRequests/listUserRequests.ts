import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

// Inicializar el cliente de DynamoDB fuera del handler para reutilización
const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

// Obtener nombre de la tabla desde variables de entorno
const purchaseRequestsTableName = process.env.PURCHASE_REQUESTS_TABLE_NAME;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    if (!purchaseRequestsTableName) {
        console.error("Error: PURCHASE_REQUESTS_TABLE_NAME no definida en variables de entorno.");
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Error de configuración interna del servidor." }),
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        };
    }

    console.log("Evento recibido para listUserRequests:", JSON.stringify(event, null, 2));

    // Obtener el email del solicitante del header personalizado
    const requesterEmail = event.headers['x-requester-email'] ?? event.headers['X-Requester-Email'];
    if (!requesterEmail) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Falta el header X-Requester-Email." }),
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        };
    }

    // Parámetros para la consulta a DynamoDB usando el GSI
    const queryParams = {
        TableName: purchaseRequestsTableName,
        IndexName: "RequesterEmailIndex", // El nombre del GSI que creamos
        KeyConditionExpression: "requesterEmail = :emailVal",
        ExpressionAttributeValues: {
            ":emailVal": requesterEmail,
        },
        // Opcional: para ordenar por fecha de creación descendente (más recientes primero)
        // Asegúrate de que 'createdAt' sea la clave de ordenación de tu GSI si usas esto.
        // ScanIndexForward: false, 
    };

    try {
        const result = await ddbDocClient.send(new QueryCommand(queryParams));

        const items = result.Items?.map(item => ({
            purchaseRequestId: item.requestId, // Mapear requestId a purchaseRequestId para la respuesta
            title: item.title,
            description: item.description,
            amount: item.amount,
            requesterEmail: item.requesterEmail,
            status: item.status,
            approverEmails: item.approverEmails,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            pdfEvidenceS3Key: item.pdfEvidenceS3Key
        }));

        return {
            statusCode: 200,
            body: JSON.stringify(items || []), // Devolver un array vacío si no hay ítems
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*", // Ajustar en producción
            },
        };
    } catch (dbError) {
        const error = dbError as Error;
        console.error("Error consultando DynamoDB:", error.message, error.stack);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Error al obtener las solicitudes de la base de datos.", error: error.message }),
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        };
    }
};