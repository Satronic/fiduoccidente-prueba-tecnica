// backend/src/handlers/purchaseRequests/getRequestById.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const purchaseRequestsTableName = process.env.PURCHASE_REQUESTS_TABLE_NAME;
const approversTableName = process.env.APPROVERS_TABLE_NAME;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    if (!purchaseRequestsTableName || !approversTableName) {
        console.error("Error: Nombres de tablas no definidos en variables de entorno.");
        return { 
            statusCode: 500, 
            body: JSON.stringify({ message: "Error de configuración interna del servidor." }), 
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
        };
    }

    console.log("Evento recibido para getRequestById:", JSON.stringify(event, null, 2));

    const requesterEmail = event.headers['x-requester-email'] || event.headers['X-Requester-Email'];
    if (!requesterEmail) {
        return { 
            statusCode: 400, 
            body: JSON.stringify({ message: "Falta el header X-Requester-Email." }), 
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
        };
    }

    const purchaseRequestId = event.pathParameters?.purchaseRequestId;
    if (!purchaseRequestId) {
        return { 
            statusCode: 400, 
            body: JSON.stringify({ message: "Falta el parámetro 'purchaseRequestId' en la ruta." }), 
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
        };
    }

    try {
        const requestResult = await ddbDocClient.send(new GetCommand({
            TableName: purchaseRequestsTableName,
            Key: { requestId: purchaseRequestId },
        }));

        if (!requestResult.Item) {
            return { 
                statusCode: 404, 
                body: JSON.stringify({ message: "Solicitud de compra no encontrada." }), 
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
            };
        }

        if (requestResult.Item.requesterEmail !== requesterEmail) {
            return { 
                statusCode: 403,
                body: JSON.stringify({ message: "Acceso denegado. No eres el propietario de esta solicitud." }), 
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
            };
        }
        
        const purchaseRequestData = requestResult.Item;

        const approversResult = await ddbDocClient.send(new QueryCommand({
            TableName: approversTableName,
            KeyConditionExpression: "requestId = :rid",
            ExpressionAttributeValues: {
                ":rid": purchaseRequestId,
            },
        }));

        const approversData = approversResult.Items?.map(app => ({
            approverEmail: app.approverEmail,
            approvalStatus: app.approvalStatus,
            decisionDate: app.decisionDate,
            signatureName: app.signatureName,
            approvalOrder: app.approvalOrder
        })).sort((a, b) => (a.approvalOrder || 0) - (b.approvalOrder || 0));

        const responseData = {
            purchaseRequestId: purchaseRequestData.requestId,
            title: purchaseRequestData.title,
            description: purchaseRequestData.description,
            amount: purchaseRequestData.amount,
            requesterEmail: purchaseRequestData.requesterEmail,
            status: purchaseRequestData.status,
            approverEmailsOriginal: purchaseRequestData.approverEmails,
            approvers: approversData || [],
            createdAt: purchaseRequestData.createdAt,
            updatedAt: purchaseRequestData.updatedAt,
            pdfEvidenceS3Key: purchaseRequestData.pdfEvidenceS3Key
        };

        return {
            statusCode: 200,
            body: JSON.stringify(responseData),
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
        };

    } catch (dbError) {
        const error = dbError as Error;
        console.error("Error interactuando con DynamoDB en getRequestById:", error.message, error.stack);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Error al obtener los detalles de la solicitud.", error: error.message }),
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        };
    }
};