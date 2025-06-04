import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const approversTableName = process.env.APPROVERS_TABLE_NAME;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    if (!approversTableName) {
        console.error("Error: APPROVERS_TABLE_NAME no definida en variables de entorno.");
        return { 
            statusCode: 500, 
            body: JSON.stringify({ message: "Error de configuración interna del servidor." }), 
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
        };
    }

    console.log("Evento recibido para getOtpForToken (debug):", JSON.stringify(event, null, 2));

    const approverToken = event.queryStringParameters?.approver_token;

    if (!approverToken) {
        return { 
            statusCode: 400, 
            body: JSON.stringify({ message: "Falta el parámetro 'approver_token' en la URL." }), 
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
        };
    }

    try {
        // 1. Obtener el registro del aprobador usando el token a través del GSI
        const approverQuery = await ddbDocClient.send(new QueryCommand({
            TableName: approversTableName,
            IndexName: "ApproverTokenIndex", // Asumiendo que este GSI existe y su PK es approverToken
            KeyConditionExpression: "approverToken = :tokenVal",
            ExpressionAttributeValues: {
                ":tokenVal": approverToken
            },
            // Traer solo los atributos necesarios
            ProjectionExpression: "otp, otpExpiration, approvalStatus" 
        }));

        if (!approverQuery.Items || approverQuery.Items.length === 0) {
            return { 
                statusCode: 404, 
                body: JSON.stringify({ message: "Token de aprobador inválido o no encontrado." }), 
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
            };
        }

        const approverRecord = approverQuery.Items[0];

        // 2. Verificar el estado, OTP y expiración
        if (approverRecord.approvalStatus !== "PendingOtp") {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ message: "El OTP no está actualmente pendiente para este token de aprobador o ya fue procesado." }), 
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
            };
        }

        const nowInSeconds = Math.floor(Date.now() / 1000);
        if (!approverRecord.otp || !approverRecord.otpExpiration || approverRecord.otpExpiration < nowInSeconds) {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ message: "OTP no disponible o ha expirado para este token." }), 
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
            };
        }

        // 3. Devolver el OTP (solo para fines de prueba/debug)
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                otp: approverRecord.otp,
                message: "OTP for testing/evaluation purposes. Do not use in production.",
                expiresInSeconds: approverRecord.otpExpiration - nowInSeconds 
            }),
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        };

    } catch (dbError) {
        const error = dbError as Error;
        console.error("Error en getOtpForToken (debug):", error.message, error.stack);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ message: "Error al obtener el OTP de prueba.", error: error.message }), 
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
        };
    }
};