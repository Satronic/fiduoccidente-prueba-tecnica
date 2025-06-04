// frontend/src/pages/ApprovalPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';
import OtpForm from '../features/approvals/OtpForm';
import ApprovalDecision from '../features/approvals/ApprovalDecision';

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
    message: string;
}

// NUEVA: Interfaz para la respuesta del endpoint /debug/otp-for-token
interface DebugOtpResponse {
    otp: string;
    message: string;
    expiresInSeconds?: number; // Opcional, si tu backend lo devuelve
}

// Ajustamos los pasos para incluir un estado donde el OTP es visible para prueba
type ApprovalStep = 'loadingInfo' | 'pendingOtp' | 'otpVisibleForTest' | 'pendingDecision' | 'decisionSubmitted' | 'error';

const ApprovalPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const purchaseRequestId = searchParams.get('purchase_request_id');
  const approverToken = searchParams.get('approver_token');

  const [step, setStep] = useState<ApprovalStep>('loadingInfo');
  const [requestDetails, setRequestDetails] = useState<PurchaseRequestDetailsForApprover | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null); // Error general para el flujo
  const [apiSuccessMessage, setApiSuccessMessage] = useState<string | null>(null);
  
  // NUEVOS ESTADOS para el OTP de prueba
  const [visibleOtpForTesting, setVisibleOtpForTesting] = useState<string | null>(null);
  const [fetchOtpError, setFetchOtpError] = useState<string | null>(null);


  useEffect(() => {
    if (!purchaseRequestId || !approverToken) {
      setApiError("Información de aprobación inválida o faltante en la URL.");
      setStep('error');
      return;
    }

    const fetchApprovalInfo = async () => {
      setApiLoading(true);
      setApiError(null);
      setApiSuccessMessage(null);
      try {
        const response = await apiClient.get<ApprovalLinkInfoResponse>(`/purchase-requests/approve`, {
          params: {
            purchase_request_id: purchaseRequestId,
            approver_token: approverToken,
          },
        });
        setRequestDetails(response.data.purchaseRequestDetails);
        setApiSuccessMessage(response.data.message);
        setStep('pendingOtp');
      } catch (err: any) {
        console.error("Error al obtener información de aprobación:", err);
        setApiError(err.response?.data?.message || "No se pudo cargar la información para la aprobación.");
        setStep('error');
      } finally {
        setApiLoading(false);
      }
    };

    fetchApprovalInfo();
  }, [purchaseRequestId, approverToken]); // Dependencias del efecto

  // NUEVA FUNCIÓN para obtener el OTP de prueba
  const handleFetchTestOtp = useCallback(async () => {
    if (!approverToken) {
        setFetchOtpError("Token de aprobador no disponible para obtener OTP de prueba.");
        return;
    }
    setApiLoading(true); // Podrías usar un loading state específico si prefieres
    setFetchOtpError(null);
    setVisibleOtpForTesting(null); // Limpiar OTP anterior
    try {
        const response = await apiClient.get<DebugOtpResponse>(`/debug/otp-for-token`, {
            params: { approver_token: approverToken },
        });
        setVisibleOtpForTesting(response.data.otp);
        setStep('otpVisibleForTest'); // Cambiar a un estado donde el OTP es visible
    } catch (err: any) {
        console.error("Error al obtener OTP de prueba:", err);
        setFetchOtpError(err.response?.data?.message || "No se pudo obtener el OTP de prueba.");
        // Mantenemos el paso en 'pendingOtp' si falla, para que el botón siga visible
        setStep('pendingOtp');
    } finally {
        setApiLoading(false);
    }
  }, [approverToken]); // approverToken es la dependencia

  const handleOtpSubmit = async (otp: string) => {
    if (!purchaseRequestId || !approverToken) return;
    setApiLoading(true);
    setApiError(null); // Limpiar errores generales
    // setFetchOtpError(null); // Ya no es necesario aquí, se limpia en handleFetchTestOtp
    setApiSuccessMessage(null);
    try {
      await apiClient.post(`/purchase-requests/${purchaseRequestId}/validate-otp`, 
        { otp },
        { headers: { 'X-Approver-Token': approverToken } }
      );
      setApiSuccessMessage("OTP validado correctamente. Por favor, tome su decisión.");
      setStep('pendingDecision');
      setVisibleOtpForTesting(null); // Limpiar el OTP visible después de un intento de envío
    } catch (err: any) {
      console.error("Error al validar OTP:", err);
      setApiError(err.response?.data?.message || "OTP inválido o expirado.");
      // Mantenemos 'pendingOtp' o 'otpVisibleForTest' para reintentar
      setStep(visibleOtpForTesting ? 'otpVisibleForTest' : 'pendingOtp');
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
      setTimeout(() => navigate('/'), 5000);
    } catch (err: any) { // Asegúrate de que 'err' sea de tipo 'any' o un tipo de error conocido
      console.error("Error al registrar la decisión:", err);
      const errorMessage = (err as any).response?.data?.message ?? "No se pudo registrar la decisión.";
      setApiError(errorMessage);
      setStep('pendingDecision'); 
    } finally {
      setApiLoading(false);
    }
  };
  
  const renderStepContent = () => {
    // Estado de carga general para las transiciones principales
    if (apiLoading && (step === 'loadingInfo' || (step === 'pendingOtp' && !visibleOtpForTesting) || step === 'pendingDecision' || step === 'otpVisibleForTest' && !visibleOtpForTesting )) {
        return <p>Cargando...</p>;
    }
    if (step === 'error' && apiError) {
      return <p style={{ color: 'red' }}>Error Principal: {apiError}</p>;
    }
    if (step === 'decisionSubmitted' && apiSuccessMessage) {
        return <p style={{ color: 'green' }}>{apiSuccessMessage} Será redirigido en breve.</p>;
    }

    // El estado 'pendingOtp' ahora también incluye el botón para obtener el OTP de prueba
    // 'otpVisibleForTest' es un sub-estado de 'pendingOtp' donde el OTP ya se mostró
    if ((step === 'pendingOtp' || step === 'otpVisibleForTest') && requestDetails) {
      return (
        <>
          <h3>Detalles de la Solicitud (para aprobación):</h3>
          <p>Título: {requestDetails.title}</p>
          <p>Monto: ${requestDetails.amount?.toFixed(2)}</p>
          {apiSuccessMessage && (step === 'pendingOtp' || step === 'otpVisibleForTest') && <p style={{ color: 'blue' }}>{apiSuccessMessage}</p>}
          
          {/* Botón para obtener OTP de prueba */}
          {step === 'pendingOtp' && !visibleOtpForTesting && ( // Mostrar solo si aún no se ha obtenido el OTP
            <button onClick={handleFetchTestOtp} disabled={apiLoading} style={{margin: '10px 0', padding: '8px 12px'}}>
              {apiLoading ? 'Obteniendo OTP...' : 'Obtener OTP de Prueba (Evaluador)'}
            </button>
          )}
          {fetchOtpError && <p style={{ color: 'orange', marginTop: '10px' }}>Error al obtener OTP: {fetchOtpError}</p>}
          {visibleOtpForTesting && (
            <p style={{ color: 'blue', fontWeight: 'bold', border: '1px dashed blue', padding: '10px', marginTop: '10px', backgroundColor: '#e7f3ff' }}>
              OTP para Prueba (Evaluador): {visibleOtpForTesting}
            </p>
          )}
          <OtpForm 
            onSubmitOtp={handleOtpSubmit} 
            isLoading={apiLoading && (step === 'pendingOtp' || step === 'otpVisibleForTest')} // Loading si estamos en estos pasos y apiLoading es true
            error={apiError && (step === 'pendingOtp' || step === 'otpVisibleForTest') ? apiError : null}
          />
        </>
      );
    }
    if (step === 'pendingDecision' && requestDetails) {
      return (
        <>
          {apiSuccessMessage && <p style={{ color: 'green' }}>{apiSuccessMessage}</p>}
          <ApprovalDecision 
            requestDetails={requestDetails} 
            onSubmitDecision={handleDecisionSubmit} 
            isLoading={apiLoading}
            error={apiError}
          />
        </>
      );
    }
    return <p>Cargando o estado desconocido del flujo...</p>; 
  };

  return (
    <div>
      <h1>Proceso de Aprobación</h1>
      {renderStepContent()}
    </div>
  );
};

export default ApprovalPage;