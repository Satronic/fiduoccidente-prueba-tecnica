// frontend/src/pages/RequestDetailPage.tsx
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import RequestDetail from '../features/purchaseRequests/RequestDetail'; // Importa el nuevo componente

const RequestDetailPage: React.FC = () => {
  const { purchaseRequestId } = useParams<{ purchaseRequestId: string }>();

  if (!purchaseRequestId) {
    return (
      <div>
        <h1>Error</h1>
        <p>No se proporcionó un ID de solicitud válido.</p>
        <Link to="/">Volver al Dashboard</Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginTop: '20px' }}>
        <Link to="/">Volver al Dashboard</Link>
      </div>
      <RequestDetail purchaseRequestId={purchaseRequestId} />
    </div>
  );
};

export default RequestDetailPage;