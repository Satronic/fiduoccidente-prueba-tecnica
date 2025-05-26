// frontend/src/pages/ApprovalPage.tsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';
import OtpForm from '../features/approvals/OtpForm'; // Importar
import ApprovalDecision from '../features/approvals/ApprovalDecision'; // Importar

// Interfaz para los detalles de la solicitud que se mostrarán al aprobador
interface PurchaseRequestDetailsForApprover {
  title: string;
  description: string;
  amount: number;
  requesterEmail?: string;
  createdAt?: string;
}

// Interfaz para la respuesta del endpoint /approve
interface ApprovalLinkInfoResponse {
    purchaseRequestId: string;
    purchaseRequestDetails: PurchaseRequestDetailsForApprover;
    message: string; // Ej. "OTP generado..."
}

type ApprovalStep = 'loadingInfo' | 'pendingOtp' | 'pendingDecision' | 'decisionSubmitted' | 'error';

const ApprovalPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const purchaseRequestId = searchParams.get('purchase_request_id');
  const approverToken = searchParams.get('approver_token');

  const [step, setStep] = useState<ApprovalStep>('loadingInfo');
  const [requestDetails, setRequestDetails] = useState<PurchaseRequestDetailsForApprover | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSuccessMessage, setApiSuccessMessage] = useState<string | null>(null);


  useEffect(() => {
    if (!purchaseRequestId || !approverToken) {
      setApiError("Información de aprobación inválida o faltante en la URL.");
      setStep('error');
      return;
    }

    const fetchApprovalInfo = async () => {
      setApiLoading(true);
      setApiError(null);
      try {
        const response = await apiClient.get<ApprovalLinkInfoResponse>(`/purchase-requests/approve`, {
          params: {
            purchase_request_id: purchaseRequestId,
            approver_token: approverToken,
          },
        });
        setRequestDetails(response.data.purchaseRequestDetails);
        setApiSuccessMessage(response.data.message); // Ej: "OTP generado..."
        setStep('pendingOtp'); // Listo para que el usuario ingrese el OTP
      } catch (err: any) {
        console.error("Error al obtener información de aprobación:", err);
        setApiError(err.response?.data?.message || "No se pudo cargar la información para la aprobación.");
        setStep('error');
      } finally {
        setApiLoading(false);
      }
    };

    fetchApprovalInfo();
  }, [purchaseRequestId, approverToken]);

  const handleOtpSubmit = async (otp: string) => {
    if (!purchaseRequestId || !approverToken) return;
    setApiLoading(true);
    setApiError(null);
    setApiSuccessMessage(null);
    try {
      // El X-Approver-Token se añade en el header para identificar la sesión de aprobación
      await apiClient.post(`/purchase-requests/${purchaseRequestId}/validate-otp`, 
        { otp },
        { headers: { 'X-Approver-Token': approverToken } }
      );
      setApiSuccessMessage("OTP validado correctamente. Por favor, tome su decisión.");
      setStep('pendingDecision'); // Listo para que el usuario apruebe/rechace
    } catch (err: any) {
      console.error("Error al validar OTP:", err);
      setApiError(err.response?.data?.message || "OTP inválido o expirado.");
      // Mantenemos el paso en 'pendingOtp' para que pueda reintentar o se muestre el error
    } finally {
      setApiLoading(false);
    }
  };

  const handleDecisionSubmit = async (decision: 'approve' | 'reject', signatureName?: string) => {
    if (!purchaseRequestId || !approverToken) return;
    setApiLoading(true);
    setApiError(null);
    setApiSuccessMessage(null);
    try {
      const payload: any = { decision };
      if (decision === 'approve' && signatureName) {
        payload.signatureName = signatureName;
      }

      await apiClient.post(`/purchase-requests/${purchaseRequestId}/decision`, 
        payload,
        { headers: { 'X-Approver-Token': approverToken } }
      );
      setApiSuccessMessage(`Decisión (${decision === 'approve' ? 'Aprobado' : 'Rechazado'}) registrada exitosamente.`);
      setStep('decisionSubmitted');
      // Opcional: redirigir después de un tiempo
      setTimeout(() => navigate('/'), 5000); // Redirigir al dashboard del solicitante (o una página de "gracias")
    } catch (err: any) {
      console.error("Error al registrar la decisión:", err);
      setApiError(err.response?.data?.message ?? "No se pudo registrar la decisión.");
      // Mantenemos el paso en 'pendingDecision' para que pueda reintentar o se muestre el error
    } finally {
      setApiLoading(false);
    }
  };

  // Renderizado condicional basado en el paso actual
  const renderStepContent = () => {
    if (step === 'loadingInfo' || apiLoading && (step === 'pendingOtp' || step === 'pendingDecision')) {
      return <p>Cargando información de aprobación...</p>;
    }
    if (step === 'error' && apiError) {
      return <p style={{ color: 'red' }}>Error: {apiError}</p>;
    }
    if (step === 'decisionSubmitted' && apiSuccessMessage) {
        return <p style={{ color: 'green' }}>{apiSuccessMessage} Será redirigido en breve.</p>;
    }

    if (step === 'pendingOtp' && requestDetails) {
      return (
        <>
          <h3>Detalles de la Solicitud:</h3>
          <p>Título: {requestDetails.title}</p>
          <p>Monto: ${requestDetails.amount?.toFixed(2)}</p>
          {apiSuccessMessage && <p style={{ color: 'blue' }}>{apiSuccessMessage}</p>} {/* Mensaje "OTP Generado" */}
          <OtpForm onSubmitOtp={handleOtpSubmit} isLoading={apiLoading} error={apiError} />
        </>
      );
    }
    if (step === 'pendingDecision' && requestDetails) {
      return (
        <>
          {apiSuccessMessage && <p style={{ color: 'green' }}>{apiSuccessMessage}</p>} {/* Mensaje "OTP Validado" */}
          <ApprovalDecision 
            requestDetails={requestDetails} 
            onSubmitDecision={handleDecisionSubmit} 
            isLoading={apiLoading}
            error={apiError} 
          />
        </>
      );
    }
    return <p>Cargando...</p>; // Estado por defecto o de carga inicial
  };


  return (
    <div>
      <h1>Proceso de Aprobación</h1>
      {renderStepContent()}
    </div>
  );
};

export default ApprovalPage;