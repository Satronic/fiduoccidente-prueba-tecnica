// frontend/src/features/purchaseRequests/RequestList.tsx
import React, { useEffect, useState } from 'react';
import apiClient from '../../services/apiClient';
import { Link, useNavigate } from 'react-router-dom'; // useNavigate para el botón

// Interfaz PurchaseRequest (puedes moverla a un archivo de tipos si se usa en más lugares)
interface PurchaseRequest {
  purchaseRequestId: string;
  title: string;
  description: string;
  amount: number;
  requesterEmail: string;
  status: string;
  approvers: Array<{
    approverEmail: string;
    approvalStatus: string;
    decisionDate?: string | null;
    signatureName?: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
  pdfEvidenceS3Key?: string | null;
}

// Mapeos de estado y color (puedes moverlos a utils/statusMappings.ts si lo prefieres)
const statusDisplayMap: { [key: string]: string } = {
  "PendingInitialApproval": "Pendiente de Aprobación Inicial",
  "PartiallyApproved": "Parcialmente Aprobada",
  "FullyApproved": "Totalmente Aprobada (Generando PDF)",
  "Rejected": "Rechazada",
  "CompletedPdfGenerated": "Completada (PDF Disponible)",
};

const statusColorMap: { [key: string]: React.CSSProperties } = {
  "PendingInitialApproval": { backgroundColor: '#fff3cd', color: '#856404', padding: '5px 8px', borderRadius: '4px', display: 'inline-block' },
  "PartiallyApproved": { backgroundColor: '#ffeeba', color: '#856404', padding: '5px 8px', borderRadius: '4px', display: 'inline-block' },
  "FullyApproved": { backgroundColor: '#d4edda', color: '#155724', padding: '5px 8px', borderRadius: '4px', display: 'inline-block' },
  "Rejected": { backgroundColor: '#f8d7da', color: '#721c24', padding: '5px 8px', borderRadius: '4px', display: 'inline-block' },
  "CompletedPdfGenerated": { backgroundColor: '#cce5ff', color: '#004085', padding: '5px 8px', borderRadius: '4px', display: 'inline-block' },
};

// Estilos de tabla (puedes moverlos a un archivo CSS o mantenerlos aquí si son específicos del componente)
const tableHeaderStyle: React.CSSProperties = {
  borderBottom: '2px solid #ddd',
  padding: '8px',
  textAlign: 'left',
  background: '#f2f2f2'
};

const tableCellStyle: React.CSSProperties = {
  borderBottom: '1px solid #ddd',
  padding: '8px',
  textAlign: 'left'
};

const callToActionButtonStyle: React.CSSProperties = {
  backgroundColor: '#007bff',
  color: 'white',
  padding: '8px 12px',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  textDecoration: 'none',
};


const RequestList: React.FC = () => {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRequests = async () => {
      setIsLoading(true);
      setError(null);
      const requesterEmail = localStorage.getItem('simulatedRequesterEmail');
      if (!requesterEmail) {
          setError("Error: Email del solicitante no configurado. Por favor, configúrelo para ver sus solicitudes.");
          setIsLoading(false);
          setRequests([]);
          return;
      }

      try {
        const response = await apiClient.get<PurchaseRequest[]>('/purchase-requests');
        setRequests(response.data);
      } catch (err: any) {
        console.error("Error al obtener las solicitudes:", err);
        setError(err.response?.data?.message || "Ocurrió un error al obtener las solicitudes.");
        setRequests([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();
    // Considera añadir 'localStorage.getItem('simulatedRequesterEmail')' como dependencia si
    // quieres que la lista se recargue automáticamente si cambia el email simulado,
    // aunque esto podría requerir un manejo de estado más global para el email simulado.
    // Por ahora, con el array vacío, se carga al montar el componente.
  }, []);

  const getStatusInSpanish = (statusKey: string): string => {
    return statusDisplayMap[statusKey] || statusKey;
  };

  const getStatusStyle = (statusKey: string): React.CSSProperties => {
    return statusColorMap[statusKey] || {};
  };

  const handleViewDetails = (purchaseRequestId: string) => {
    navigate(`/requests/${purchaseRequestId}`);
  };

  if (isLoading) {
    return <p>Cargando solicitudes...</p>;
  }

  if (error) {
    return <p style={{ color: 'red' }}>{error}</p>;
  }

  if (requests.length === 0) {
    return <p>No has creado ninguna solicitud de compra todavía, o no se encontraron solicitudes para el email configurado.</p>;
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={tableHeaderStyle}>ID de Solicitud</th>
          <th style={tableHeaderStyle}>Título</th>
          <th style={tableHeaderStyle}>Monto</th>
          <th style={tableHeaderStyle}>Estado</th>
          <th style={tableHeaderStyle}>Fecha Creación</th>
          <th style={tableHeaderStyle}>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {requests.map((req) => (
          <tr key={req.purchaseRequestId}>
            <td style={tableCellStyle}>{req.purchaseRequestId.substring(0,8)}...</td>
            <td style={tableCellStyle}>{req.title}</td>
            <td style={tableCellStyle}>{req.amount.toFixed(2)}</td>
            <td style={tableCellStyle}>
              <span style={getStatusStyle(req.status)}>
                {getStatusInSpanish(req.status)}
              </span>
            </td>
            <td style={tableCellStyle}>{new Date(req.createdAt).toLocaleDateString()}</td>
            <td style={tableCellStyle}>
              <button 
                onClick={() => handleViewDetails(req.purchaseRequestId)}
                style={callToActionButtonStyle}
              >
                Ver Detalles
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default RequestList;