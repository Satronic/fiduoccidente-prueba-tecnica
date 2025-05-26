import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"; // QueryCommand si buscas por token en GSI
import { randomInt } from 'crypto'; // Para generar OTP simple

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const purchaseRequestsTableName = process.env.PURCHASE_REQUESTS_TABLE_NAME;
const approversTableName = process.env.APPROVERS_TABLE_NAME;
const OTP_VALIDITY_MINUTES = 3;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    if (!purchaseRequestsTableName || !approversTableName) {
        console.error("Error: Nombres de tablas no definidos.");
        return { statusCode: 500, body: JSON.stringify({ message: "Error de configuración interna." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
    }

    console.log("Evento recibido para getApprovalInfo:", JSON.stringify(event, null, 2));

    const purchaseRequestId = event.queryStringParameters?.purchase_request_id;
    const approverToken = event.queryStringParameters?.approver_token;

    if (!purchaseRequestId || !approverToken) {
        return { statusCode: 400, body: JSON.stringify({ message: "Faltan 'purchase_request_id' o 'approver_token' en los parámetros de la URL." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
    }

    try {
        // 1. Validar el approverToken y obtener el approverEmail
        const approverQuery = await ddbDocClient.send(new QueryCommand({
            TableName: approversTableName,
            IndexName: "ApproverTokenIndex", // Asumiendo que este GSI existe y su PK es approverToken
            KeyConditionExpression: "approverToken = :tokenVal",
            ExpressionAttributeValues: {
                ":tokenVal": approverToken
            }
        }));

        if (!approverQuery.Items || approverQuery.Items.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ message: "Token de aprobador inválido o no encontrado." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
        }

        const approverRecord = approverQuery.Items[0];

        // Verificar que el token corresponda al purchaseRequestId (importante si el token no es globalmente único por sí solo)
        if (approverRecord.requestId !== purchaseRequestId) {
             return { statusCode: 403, body: JSON.stringify({ message: "Token no válido para esta solicitud." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
        }

        // Verificar si la aprobación ya fue procesada o rechazada
        if (approverRecord.approvalStatus === "Signed" || approverRecord.approvalStatus === "Rejected") {
            return { statusCode: 400, body: JSON.stringify({ message: `Esta solicitud ya fue ${approverRecord.approvalStatus === "Signed" ? 'aprobada' : 'rechazada'} por usted.` }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
        }

        // 2. Generar y guardar el OTP (simulado) y su expiración
        const otp = randomInt(100000, 999999).toString(); // OTP de 6 dígitos
        const otpExpiration = Math.floor(Date.now() / 1000) + (OTP_VALIDITY_MINUTES * 60); // Expiración en segundos (timestamp Epoch)
        const updatedAt = new Date().toISOString();

        await ddbDocClient.send(new UpdateCommand({
            TableName: approversTableName,
            Key: {
                requestId: purchaseRequestId,
                approverEmail: approverRecord.approverEmail // Necesitamos la clave completa para actualizar
            },
            UpdateExpression: "SET otp = :otp, otpExpiration = :otpExp, approvalStatus = :status, updatedAt = :ua",
            ExpressionAttributeValues: {
                ":otp": otp,
                ":otpExp": otpExpiration,
                ":status": "PendingOtp", // Cambiamos a este estado
                ":ua": updatedAt
            }
        }));

        console.log(`OTP generado para ${approverRecord.approverEmail} (Solicitud ${purchaseRequestId}): ${otp}`); // NO enviar en respuesta

        // 3. Obtener los detalles de la solicitud de compra para mostrar al aprobador
        const requestResult = await ddbDocClient.send(new GetCommand({
            TableName: purchaseRequestsTableName,
            Key: { requestId: purchaseRequestId },
        }));

        if (!requestResult.Item) {
            // Esto no debería pasar si el approverRecord es válido, pero por si acaso
            return { statusCode: 404, body: JSON.stringify({ message: "Detalles de la solicitud de compra no encontrados." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
        }

        const purchaseRequestData = requestResult.Item;

        // Información a devolver al frontend para que el aprobador la vea ANTES de ingresar el OTP
        const responseData = {
            purchaseRequestId: purchaseRequestData.requestId,
            purchaseRequestDetails: {
                title: purchaseRequestData.title,
                description: purchaseRequestData.description,
                amount: purchaseRequestData.amount,
                requesterEmail: purchaseRequestData.requesterEmail,
                createdAt: purchaseRequestData.createdAt
            },
            message: "OTP generado. Por favor, ingréselo para continuar." 
            // NO SE DEVUELVE EL OTP! El frontend lo pedirá o simulará su recepción.
            // Para esta prueba, el frontend podría necesitar "adivinarlo" o podrías loguearlo aquí para tus pruebas.
        };

        return {
            statusCode: 200,
            body: JSON.stringify(responseData),
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        };

    } catch (dbError) {
        const error = dbError as Error;
        console.error("Error en getApprovalInfo:", error.message, error.stack);
        return { statusCode: 500, body: JSON.stringify({ message: "Error al procesar la solicitud de aprobación.", error: error.message }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
    }
};