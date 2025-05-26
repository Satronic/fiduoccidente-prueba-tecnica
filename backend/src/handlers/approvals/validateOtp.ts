import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const approversTableName = process.env.APPROVERS_TABLE_NAME;

interface ValidateOtpInput {
    otp: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    if (!approversTableName) {
        console.error("Error: APPROVERS_TABLE_NAME no definida en variables de entorno.");
        return { statusCode: 500, body: JSON.stringify({ message: "Error de configuración interna." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
    }

    console.log("Evento recibido para validateOtp:", JSON.stringify(event, null, 2));

    const purchaseRequestId = event.pathParameters?.purchaseRequestId;
    // El X-Approver-Token se envía en el header para identificar al aprobador en esta sesión
    const approverToken = event.headers['x-approver-token'] ?? event.headers['X-Approver-Token'];

    if (!purchaseRequestId) {
        return { statusCode: 400, body: JSON.stringify({ message: "Falta el parámetro 'purchaseRequestId' en la ruta." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
    }
    if (!approverToken) {
        return { statusCode: 400, body: JSON.stringify({ message: "Falta el header X-Approver-Token." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
    }

    let requestBody: ValidateOtpInput;
    try {
        if (!event.body) {
            throw new Error("Cuerpo de la solicitud vacío.");
        }
        requestBody = JSON.parse(event.body) as ValidateOtpInput;
    } catch (error) {
        console.error("Error parseando el cuerpo de la solicitud:", error);
        return { statusCode: 400, body: JSON.stringify({ message: "Cuerpo de la solicitud inválido o malformado." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
    }

    if (!requestBody.otp || typeof requestBody.otp !== 'string') {
        return { statusCode: 400, body: JSON.stringify({ message: "OTP faltante o en formato incorrecto en el cuerpo de la solicitud." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
    }

    try {
        // 1. Obtener el registro del aprobador usando el token
        const approverQuery = await ddbDocClient.send(new QueryCommand({
            TableName: approversTableName,
            IndexName: "ApproverTokenIndex",
            KeyConditionExpression: "approverToken = :tokenVal",
            ExpressionAttributeValues: {
                ":tokenVal": approverToken
            }
        }));

        if (!approverQuery.Items || approverQuery.Items.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ message: "Token de aprobador inválido o no encontrado." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
        }

        const approverRecord = approverQuery.Items[0];

        // Asegurarse de que el token y el requestId coincidan (seguridad adicional)
        if (approverRecord.requestId !== purchaseRequestId) {
            return { statusCode: 403, body: JSON.stringify({ message: "Token no coincide con la solicitud de compra." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
        }

        // 2. Verificar el estado, OTP y expiración
        if (approverRecord.approvalStatus !== "PendingOtp") {
            return { statusCode: 400, body: JSON.stringify({ message: "OTP no está pendiente para esta aprobación o ya fue procesado." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
        }

        const nowInSeconds = Math.floor(Date.now() / 1000);
        if (approverRecord.otpExpiration < nowInSeconds) {
            // Opcional: Podrías invalidar el OTP aquí o simplemente devolver error
            return { statusCode: 400, body: JSON.stringify({ message: "OTP ha expirado." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
        }

        if (approverRecord.otp !== requestBody.otp) {
            // Opcional: Podrías implementar un contador de intentos fallidos aquí
            return { statusCode: 400, body: JSON.stringify({ message: "OTP inválido." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
        }

        // 3. OTP validado correctamente: Actualizar estado e invalidar OTP
        const updatedAt = new Date().toISOString();
        await ddbDocClient.send(new UpdateCommand({
            TableName: approversTableName,
            Key: {
                requestId: purchaseRequestId,
                approverEmail: approverRecord.approverEmail
            },
            UpdateExpression: "SET approvalStatus = :newStatus, otp = :nullOtp, otpExpiration = :nullOtpExp, updatedAt = :ua", // Invalida OTP
            ExpressionAttributeValues: {
                ":newStatus": "PendingDecision", // Nuevo estado después de OTP validado
                ":nullOtp": null, // O puedes usar REMOVE otp, otpExpiration
                ":nullOtpExp": null,
                ":ua": updatedAt
            }
        }));

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "OTP validado correctamente. Puede proceder a tomar una decisión." }),
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        };

    } catch (dbError) {
        const error = dbError as Error;
        console.error("Error en validateOtp:", error.message, error.stack);
        return { statusCode: 500, body: JSON.stringify({ message: "Error al validar el OTP.", error: error.message }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
    }
};