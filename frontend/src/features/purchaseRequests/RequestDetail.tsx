// frontend/src/features/purchaseRequests/RequestDetail.tsx
import React, { useEffect, useState } from 'react';
import apiClient from '../../services/apiClient';
// useParams no es necesario aquí si el ID viene como prop
// import { useParams } from 'react-router-dom'; 

// ... (Interfaces PurchaseRequestDetail, ApproverDetail como antes)
interface ApproverDetail {
  approverEmail: string;
  approvalStatus: string;
  decisionDate?: string | null;
  signatureName?: string | null;
  approvalOrder: number;
}

interface PurchaseRequestDetail {
  purchaseRequestId: string;
  title: string;
  description: string;
  amount: number;
  requesterEmail: string;
  status: string;
  approvers: ApproverDetail[];
  createdAt: string;
  updatedAt: string;
  pdfEvidenceS3Key?: string | null;
}


// ... (statusDisplayMap, approvalStatusDisplayMap, statusColorMap como antes)
const statusDisplayMap: { [key: string]: string } = {
  "PendingInitialApproval": "Pendiente de Aprobación Inicial",
  "PartiallyApproved": "Parcialmente Aprobada",
  "FullyApproved": "Totalmente Aprobada (Generando PDF)",
  "Rejected": "Rechazada",
  "CompletedPdfGenerated": "Completada (PDF Disponible)",
};

const approvalStatusDisplayMap: { [key: string]: string } = {
    "PendingOtp": "Pendiente OTP",
    "PendingDecision": "Pendiente Decisión",
    "Signed": "Firmado",
    "Rejected": "Rechazado",
};

const statusColorMap: { [key: string]: React.CSSProperties } = {
  "PendingInitialApproval": { backgroundColor: '#fff3cd', color: '#856404', padding: '5px 8px', borderRadius: '4px', display: 'inline-block', margin: '2px' },
  "PartiallyApproved": { backgroundColor: '#ffeeba', color: '#856404', padding: '5px 8px', borderRadius: '4px', display: 'inline-block', margin: '2px' },
  "FullyApproved": { backgroundColor: '#d4edda', color: '#155724', padding: '5px 8px', borderRadius: '4px', display: 'inline-block', margin: '2px' },
  "Rejected": { backgroundColor: '#f8d7da', color: '#721c24', padding: '5px 8px', borderRadius: '4px', display: 'inline-block', margin: '2px' },
  "CompletedPdfGenerated": { backgroundColor: '#cce5ff', color: '#004085', padding: '5px 8px', borderRadius: '4px', display: 'inline-block', margin: '2px' },
  "PendingOtp": { backgroundColor: '#fff3cd', color: '#856404', padding: '3px 6px', borderRadius: '3px', fontSize: '0.9em', display: 'inline-block', margin: '2px' },
  "PendingDecision": { backgroundColor: '#ffeeba', color: '#856404', padding: '3px 6px', borderRadius: '3px', fontSize: '0.9em', display: 'inline-block', margin: '2px' },
  "Signed": { backgroundColor: '#d4edda', color: '#155724', padding: '3px 6px', borderRadius: '3px', fontSize: '0.9em', display: 'inline-block', margin: '2px' },
};


interface RequestDetailProps {
  purchaseRequestId: string;
}

const RequestDetail: React.FC<RequestDetailProps> = ({ purchaseRequestId }) => {
  const [request, setRequest] = useState<PurchaseRequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL_FOR_PDF = (import.meta.env.VITE_API_BASE_URL || 'https://TU_API_ID.execute-api.us-east-1.amazonaws.com/dev').replace(/\/$/, '');

  useEffect(() => {
    if (!purchaseRequestId) {
      setError("ID de solicitud no proporcionado.");
      setIsLoading(false);
      return;
    }
    const fetchRequestDetail = async () => {
      // ... (lógica de fetchRequestDetail como antes)
      setIsLoading(true);
      setError(null);
      const requesterEmail = localStorage.getItem('simulatedRequesterEmail');
      if (!requesterEmail) {
          setError("Error: Email del solicitante no configurado. Por favor, configúrelo en la barra de navegación.");
          setIsLoading(false);
          return;
      }
      try {
        const response = await apiClient.get<PurchaseRequestDetail>(`/purchase-requests/${purchaseRequestId}`);
        setRequest(response.data);
      } catch (err: any) {
        console.error("Error al obtener el detalle de la solicitud:", err);
        setError(err.response?.data?.message || "Ocurrió un error al obtener el detalle de la solicitud.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchRequestDetail();
  }, [purchaseRequestId]);

  const getStatusInSpanish = (statusKey: string, map: { [key: string]: string }): string => {
    return map[statusKey] || statusKey;
  };

  const getStatusStyle = (statusKey: string): React.CSSProperties => {
    return statusColorMap[statusKey] || {};
  };

  // Estilos para el layout de dos paneles
  const mainContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    gap: '20px', // Espacio entre los paneles
  };

  const panelStyle: React.CSSProperties = {
    flex: 1, // Cada panel tomará la mitad del espacio disponible
    padding: '20px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    backgroundColor: '#f9f9f9',
  };
  
  const detailTitleStyle: React.CSSProperties = { marginTop: '0', color: '#333', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' };
  const labelStyle: React.CSSProperties = { fontWeight: 'bold', marginRight: '5px', color: '#555' };
  const valueStyle: React.CSSProperties = { marginBottom: '10px', color: '#222' }; // Estilo para los valores
  const approverItemStyle: React.CSSProperties = { marginBottom: '15px', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', backgroundColor: '#fff' };


  if (isLoading) {
    return <p>Cargando detalles de la solicitud...</p>;
  }

  if (error) {
    return <p style={{ color: 'red' }}>{error}</p>;
  }

  if (!request) {
    return <p>No se encontraron detalles para esta solicitud.</p>;
  }

  return (
    <div>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Detalle de Solicitud de Compra</h2>
      <div style={mainContainerStyle}>
        {/* Panel Izquierdo: Detalles de la Solicitud */}
        <div style={panelStyle}>
          <h3 style={detailTitleStyle}>Información General</h3>
          <p style={valueStyle}><span style={labelStyle}>ID:</span> {request.purchaseRequestId}</p>
          <p style={valueStyle}><span style={labelStyle}>Título:</span> {request.title}</p>
          <p style={valueStyle}><span style={labelStyle}>Descripción:</span> {request.description}</p>
          <p style={valueStyle}><span style={labelStyle}>Monto:</span> ${request.amount.toFixed(2)}</p>
          <p style={valueStyle}><span style={labelStyle}>Solicitante:</span> {request.requesterEmail}</p>
          <p style={valueStyle}>
            <span style={labelStyle}>Estado General:</span>
            <span style={getStatusStyle(request.status)}>
              {getStatusInSpanish(request.status, statusDisplayMap)}
            </span>
          </p>
          <p style={valueStyle}><span style={labelStyle}>Fecha de Creación:</span> {new Date(request.createdAt).toLocaleString()}</p>
          <p style={valueStyle}><span style={labelStyle}>Última Actualización:</span> {new Date(request.updatedAt).toLocaleString()}</p>
          
          {request.status === "CompletedPdfGenerated" && request.pdfEvidenceS3Key && (
            <div style={{ marginTop: '25px' }}>
              <a 
                href={`${API_BASE_URL_FOR_PDF}/purchase-requests/${request.purchaseRequestId}/evidence.pdf`}
                target="_blank" 
                rel="noopener noreferrer"
                style={{ 
                    padding: '10px 15px', 
                    backgroundColor: '#28a745', 
                    color: 'white', 
                    textDecoration: 'none', 
                    borderRadius: '4px',
                    display: 'inline-block'
                }}
              >
                Descargar PDF de Evidencia
              </a>
            </div>
          )}
        </div>

        {/* Panel Derecho: Estado de Aprobadores */}
        <div style={panelStyle}>
          <h3 style={detailTitleStyle}>Estado de Aprobadores</h3>
          {request.approvers && request.approvers.length > 0 ? (
            request.approvers.map((approver) => ( // No necesitamos el index si usamos approver.approverEmail o algo único como key
              <div key={approver.approverEmail + approver.approvalOrder} style={approverItemStyle}> {/* Clave más robusta */}
                <p style={valueStyle}><span style={labelStyle}>Aprobador {approver.approvalOrder}:</span> {approver.approverEmail}</p>
                <p style={valueStyle}>
                  <span style={labelStyle}>Estado:</span>
                  <span style={getStatusStyle(approver.approvalStatus)}>
                    {getStatusInSpanish(approver.approvalStatus, approvalStatusDisplayMap)}
                  </span>
                </p>
                {approver.decisionDate && (
                  <p style={valueStyle}><span style={labelStyle}>Fecha Decisión:</span> {new Date(approver.decisionDate).toLocaleString()}</p>
                )}
                {approver.signatureName && approver.approvalStatus === "Signed" && (
                  <p style={valueStyle}><span style={labelStyle}>Firmado por:</span> {approver.signatureName}</p>
                )}
              </div>
            ))
          ) : (
            <p>No hay información de aprobadores disponible para esta solicitud.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestDetail;