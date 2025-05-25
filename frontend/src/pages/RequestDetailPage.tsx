// frontend/src/pages/RequestDetailPage.tsx
import React from 'react';
import { useParams } from 'react-router-dom';

const RequestDetailPage: React.FC = () => {
  const { purchaseRequestId } = useParams<{ purchaseRequestId: string }>();
  return (
    <div>
      <h1>Detalle de la Solicitud: {purchaseRequestId}</h1>
      <p>Aquí se mostrarán los detalles de la solicitud y el estado de los aprobadores.</p>
    </div>
  );
};

export default RequestDetailPage;