// backend/src/handlers/purchaseRequests/createRequest.ts

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from 'crypto'; // Para generar UUIDs

// Inicializar el cliente de DynamoDB fuera del handler para reutilización
const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

// Obtener nombres de las tablas y la URL del frontend desde variables de entorno
const purchaseRequestsTableName = process.env.PURCHASE_REQUESTS_TABLE_NAME;
const approversTableName = process.env.APPROVERS_TABLE_NAME;
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3001"; // Un valor por defecto si no está configurada

interface CreateRequestInput {
    title: string;
    description: string;
    amount: number;
    approverEmails: string[]; // Se espera un array de 3 correos electrónicos
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    // Verificar que las variables de entorno para las tablas estén configuradas
    if (!purchaseRequestsTableName || !approversTableName) {
        console.error("Error: Nombres de tablas (PURCHASE_REQUESTS_TABLE_NAME, APPROVERS_TABLE_NAME) no definidos en variables de entorno.");
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Error de configuración interna del servidor." }),
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        };
    }

    console.log("Evento recibido para createRequest:", JSON.stringify(event, null, 2));

    // Obtener el email del solicitante del header personalizado
    const requesterEmail = event.headers['x-requester-email'] ?? event.headers['X-Requester-Email'];
    if (!requesterEmail) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Falta el header X-Requester-Email." }),
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        };
    }

    let requestBody: CreateRequestInput;
    try {
        if (!event.body) {
            throw new Error("Cuerpo de la solicitud vacío.");
        }
        requestBody = JSON.parse(event.body) as CreateRequestInput;
    } catch (error) {
        console.error("Error parseando el cuerpo de la solicitud:", error);
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Cuerpo de la solicitud inválido o malformado." }),
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        };
    }

    // Validación básica de los datos de entrada
    if (!requestBody.title || 
        !requestBody.description || 
        typeof requestBody.amount !== 'number' || 
        requestBody.amount <= 0 ||
        !requestBody.approverEmails || 
        !Array.isArray(requestBody.approverEmails) || 
        requestBody.approverEmails.length !== 3 ||
        requestBody.approverEmails.some(email => typeof email !== 'string' || !email.includes('@'))) { // Verifica que sean 3 emails válidos (básico)
        return {
            statusCode: 400,
            body: JSON.stringify({ 
                message: "Datos de entrada inválidos. Se requieren: title (string), description (string), amount (number > 0), y exactamente 3 approverEmails (array de strings con formato de email)." 
            }),
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        };
    }

    const purchaseRequestId = randomUUID(); // Usaremos este como el 'requestId' en DynamoDB
    const createdAt = new Date().toISOString();
    const initialStatus = "PendingInitialApproval"; // Estado inicial de la solicitud

    // Ítem para PurchaseRequestsTable
    const purchaseRequestItem = {
        requestId: purchaseRequestId, // Clave de partición
        title: requestBody.title,
        description: requestBody.description,
        amount: requestBody.amount,
        requesterEmail: requesterEmail,
        status: initialStatus,
        approverEmails: requestBody.approverEmails, // Guardamos la lista original para referencia
        createdAt: createdAt,
        updatedAt: createdAt,
        // pdfEvidenceS3Key: null // Inicialmente no hay PDF
    };

    // Preparar los ítems para ApproversTable
    const approverItemsPromises: Promise<any>[] = [];
    const generatedApproverInfoForResponse: Array<{ approverEmail: string, approvalStatus: string, approverToken?: string, approvalLink?: string }> = [];

    for (let i = 0; i < requestBody.approverEmails.length; i++) {
        const approverEmail = requestBody.approverEmails[i];
        const approverToken = randomUUID();
        const approvalOrder = i + 1; // Orden de aprobación 1, 2, 3

        const approverItem = {
            requestId: purchaseRequestId, // Clave de partición, vincula al PurchaseRequest
            approverEmail: approverEmail, // Clave de ordenación
            approverToken: approverToken,
            approvalOrder: approvalOrder,
            approvalStatus: "PendingOtp", // Estado inicial para cada aprobación individual
            createdAt: createdAt,
            updatedAt: createdAt,
        };

        approverItemsPromises.push(
            ddbDocClient.send(new PutCommand({
                TableName: approversTableName,
                Item: approverItem,
            }))
        );

        // Para el log de simulación de correo y potencialmente para una respuesta más detallada (si se decidiera)
        const approvalLink = `${frontendUrl}/approve?purchase_request_id=${purchaseRequestId}&approver_token=${approverToken}`;
        generatedApproverInfoForResponse.push({ 
            approverEmail: approverEmail, 
            approvalStatus: "PendingOtp",
            // Los siguientes solo para logging, no usualmente para la respuesta de este endpoint
            approverToken: approverToken, 
            approvalLink: approvalLink 
        });
    }

    try {
        // Guardar el ítem principal de la solicitud de compra
        await ddbDocClient.send(new PutCommand({
            TableName: purchaseRequestsTableName,
            Item: purchaseRequestItem,
        }));

        // Guardar todos los ítems de los aprobadores en paralelo
        await Promise.all(approverItemsPromises);

        // Simulación de envío de correos (loguear la información)
        console.log("Simulación de envío de correos para aprobación:");
        generatedApproverInfoForResponse.forEach(info => {
            console.log(`  Destinatario: ${info.approverEmail}`);
            console.log(`  Asunto: Nueva solicitud de compra (${purchaseRequestItem.title}) requiere su aprobación`);
            console.log(`  Cuerpo: Por favor, revise y apruebe la solicitud en el siguiente link:`);
            console.log(`  Link: ${info.approvalLink}`);
            console.log(`  ---`);
        });
        
        // Preparar los datos de respuesta según el schema PurchaseRequestResponse de OpenAPI
        const responseData = {
            purchaseRequestId: purchaseRequestItem.requestId,
            title: purchaseRequestItem.title,
            description: purchaseRequestItem.description,
            amount: purchaseRequestItem.amount,
            requesterEmail: purchaseRequestItem.requesterEmail,
            status: purchaseRequestItem.status,
            approvers: purchaseRequestItem.approverEmails.map(email => ({ // Mapear para coincidir con ApproverInfo schema
                approverEmail: email,
                approvalStatus: "PendingOtp", // O el estado inicial que corresponda
                // decisionDate: null, // Inicialmente null
                // signatureName: null // Inicialmente null
            })),
            createdAt: purchaseRequestItem.createdAt,
            updatedAt: purchaseRequestItem.updatedAt,
            // pdfEvidenceS3Key no se incluye o es null
        };

        return {
            statusCode: 201, // Created
            body: JSON.stringify(responseData),
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*", // Ajustar en producción
            },
        };
    } catch (dbError) {
        const error = dbError as Error;
        console.error("Error interactuando con DynamoDB:", error.message, error.stack);
        // En un caso real, aquí podrías implementar lógica para eliminar los ítems de aprobadores si la solicitud principal falló,
        // o viceversa, aunque DynamoDB no tiene transacciones rollback sencillas para múltiples PutItem fuera de TransactWriteItems.
        // Para esta prueba, un error 500 es suficiente.
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Error al guardar la solicitud en la base de datos.", error: error.message }),
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        };
    }
};