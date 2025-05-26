// frontend/src/features/approvals/ApprovalDecision.tsx
import React, { useState } from 'react';

// Reutilizamos la interfaz de detalle de solicitud, o una versión simplificada para el aprobador
interface PurchaseRequestDetailsForApprover {
  title: string;
  description: string;
  amount: number;
  requesterEmail?: string; // Opcional, si se lo mostramos
  createdAt?: string;      // Opcional
}

interface ApprovalDecisionProps {
  requestDetails: PurchaseRequestDetailsForApprover;
  onSubmitDecision: (decision: 'approve' | 'reject', signatureName?: string) => void;
  isLoading: boolean;
  error?: string | null;
}

const ApprovalDecision: React.FC<ApprovalDecisionProps> = ({ requestDetails, onSubmitDecision, isLoading, error }) => {
  const [signatureName, setSignatureName] = useState('');
  const [decisionMade, setDecisionMade] = useState<'approve' | 'reject' | null>(null);

  const handleDecision = (decision: 'approve' | 'reject') => {
    if (isLoading) return;

    if (decision === 'approve' && !signatureName.trim()) {
      alert("Por favor, ingrese su nombre para la firma.");
      return;
    }
    setDecisionMade(decision); // Para feedback visual en el botón
    onSubmitDecision(decision, decision === 'approve' ? signatureName : undefined);
  };

  // Estilos (puedes moverlos a CSS)
  const detailSectionStyle: React.CSSProperties = { marginBottom: '15px'};
  const labelStyle: React.CSSProperties = { fontWeight: 'bold', marginRight: '5px'};
  const buttonContainerStyle: React.CSSProperties = { marginTop: '20px', display: 'flex', gap: '10px' };
  const signatureInputStyle: React.CSSProperties = { width: '100%', padding: '8px', marginTop: '5px', marginBottom: '10px' };


  return (
    <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h3>Detalles de la Solicitud a Aprobar/Rechazar</h3>
      <div style={detailSectionStyle}>
        <p><span style={labelStyle}>Título:</span> {requestDetails.title}</p>
        <p><span style={labelStyle}>Descripción:</span> {requestDetails.description}</p>
        <p><span style={labelStyle}>Monto:</span> ${requestDetails.amount?.toFixed(2)}</p>
        {requestDetails.requesterEmail && <p><span style={labelStyle}>Solicitante:</span> {requestDetails.requesterEmail}</p>}
      </div>
      
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <div>
        <label htmlFor="signatureNameInput" style={{ display: 'block', marginBottom: '5px' }}>Su Nombre (para la firma si aprueba):</label>
        <input
          type="text"
          id="signatureNameInput"
          value={signatureName}
          onChange={(e) => setSignatureName(e.target.value)}
          style={signatureInputStyle}
          placeholder="Ingrese su nombre completo"
        />
      </div>

      <div style={buttonContainerStyle}>
        <button 
          onClick={() => handleDecision('approve')} 
          disabled={isLoading || !signatureName.trim()}
          style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', flex: 1 }}
        >
          {isLoading && decisionMade === 'approve' ? 'Procesando...' : 'Aprobar'}
        </button>
        <button 
          onClick={() => handleDecision('reject')} 
          disabled={isLoading}
          style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', flex: 1 }}
        >
          {isLoading && decisionMade === 'reject' ? 'Procesando...' : 'Rechazar'}
        </button>
      </div>
    </div>
  );
};

export default ApprovalDecision;