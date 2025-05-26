import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const purchaseRequestsTableName = process.env.PURCHASE_REQUESTS_TABLE_NAME;
const approversTableName = process.env.APPROVERS_TABLE_NAME;

interface DecisionInput {
    decision: "approve" | "reject";
    signatureName?: string; // Opcional, solo si aprueba
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    if (!purchaseRequestsTableName || !approversTableName) {
        console.error("Error: Nombres de tablas no definidos.");
        return { statusCode: 500, body: JSON.stringify({ message: "Error de configuración interna." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
    }

    console.log("Evento recibido para submitDecision:", JSON.stringify(event, null, 2));

    const purchaseRequestId = event.pathParameters?.purchaseRequestId;
    const approverToken = event.headers['x-approver-token'] || event.headers['X-Approver-Token'];

    if (!purchaseRequestId) {
        return { statusCode: 400, body: JSON.stringify({ message: "Falta el parámetro 'purchaseRequestId' en la ruta." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
    }
    if (!approverToken) {
        return { statusCode: 400, body: JSON.stringify({ message: "Falta el header X-Approver-Token." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
    }

    let requestBody: DecisionInput;
    try {
        if (!event.body) { throw new Error("Cuerpo de la solicitud vacío."); }
        requestBody = JSON.parse(event.body) as DecisionInput;
    } catch (error) {
        console.error("Error parseando el cuerpo:", error);
        return { statusCode: 400, body: JSON.stringify({ message: "Cuerpo de la solicitud inválido." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
    }

    if (!requestBody.decision || (requestBody.decision !== "approve" && requestBody.decision !== "reject")) {
        return { statusCode: 400, body: JSON.stringify({ message: "Decisión inválida. Debe ser 'approve' o 'reject'." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
    }
    if (requestBody.decision === "approve" && !requestBody.signatureName) {
        return { statusCode: 400, body: JSON.stringify({ message: "Falta 'signatureName' para la aprobación." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
    }

    try {
        // 1. Obtener el registro del aprobador usando el token
        const approverQuery = await ddbDocClient.send(new QueryCommand({
            TableName: approversTableName,
            IndexName: "ApproverTokenIndex",
            KeyConditionExpression: "approverToken = :tokenVal",
            ExpressionAttributeValues: { ":tokenVal": approverToken }
        }));

        if (!approverQuery.Items || approverQuery.Items.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ message: "Token de aprobador inválido o no encontrado." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
        }
        const approverRecord = approverQuery.Items[0];

        if (approverRecord.requestId !== purchaseRequestId) {
            return { statusCode: 403, body: JSON.stringify({ message: "Token no coincide con la solicitud de compra." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
        }

        // 2. Verificar que el estado del aprobador sea "PendingDecision" (OTP ya validado)
        if (approverRecord.approvalStatus !== "PendingDecision") {
            return { statusCode: 400, body: JSON.stringify({ message: "La decisión no está pendiente para este aprobador (OTP no validado o decisión ya tomada)." }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
        }

        // 3. Actualizar el registro del aprobador
        const newApprovalStatus = requestBody.decision === "approve" ? "Signed" : "Rejected";
        const decisionDate = new Date().toISOString();

        await ddbDocClient.send(new UpdateCommand({
            TableName: approversTableName,
            Key: { requestId: purchaseRequestId, approverEmail: approverRecord.approverEmail },
            UpdateExpression: "SET approvalStatus = :status, decisionDate = :date, signatureName = :sig, updatedAt = :ua",
            ExpressionAttributeValues: {
                ":status": newApprovalStatus,
                ":date": decisionDate,
                ":sig": requestBody.decision === "approve" ? requestBody.signatureName : null,
                ":ua": decisionDate
            }
        }));

        // 4. Verificar si todas las aprobaciones están completas y actualizar el estado de la solicitud principal
        let overallRequestStatus = "PartiallyApproved"; // Por defecto, si no todos han firmado aún

        if (newApprovalStatus === "Rejected") {
            overallRequestStatus = "Rejected";
        } else {
            // Consultar todos los aprobadores para esta solicitud
            const allApproversResult = await ddbDocClient.send(new QueryCommand({
                TableName: approversTableName,
                KeyConditionExpression: "requestId = :rid",
                ExpressionAttributeValues: { ":rid": purchaseRequestId }
            }));

            const allApprovers = allApproversResult.Items || [];
            const signedCount = allApprovers.filter(app => app.approvalStatus === "Signed").length;

            if (signedCount === 3) { // Asumiendo 3 aprobadores requeridos
                overallRequestStatus = "FullyApproved"; // Listo para generar PDF
            } else if (allApprovers.some(app => app.approvalStatus === "Rejected")) { // Si alguno rechazó mientras otros firmaban
                overallRequestStatus = "Rejected";
            }
        }

        await ddbDocClient.send(new UpdateCommand({
            TableName: purchaseRequestsTableName,
            Key: { requestId: purchaseRequestId },
            UpdateExpression: "SET #s = :status, updatedAt = :ua",
            ExpressionAttributeNames: { "#s": "status" }, // 'status' es una palabra reservada en DynamoDB
            ExpressionAttributeValues: {
                ":status": overallRequestStatus,
                ":ua": decisionDate
            }
        }));

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: `Decisión '${requestBody.decision}' registrada exitosamente.`,
                purchaseRequestId: purchaseRequestId,
                approverEmail: approverRecord.approverEmail,
                newApprovalStatus: newApprovalStatus,
                overallRequestStatus: overallRequestStatus
            }),
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        };

    } catch (dbError) {
        const error = dbError as Error;
        console.error("Error en submitDecision:", error.message, error.stack);
        return { statusCode: 500, body: JSON.stringify({ message: "Error al registrar la decisión.", error: error.message }), headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } };
    }
};