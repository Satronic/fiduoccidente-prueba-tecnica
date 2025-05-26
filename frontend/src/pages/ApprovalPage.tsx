// frontend/src/pages/ApprovalPage.tsx
import React from 'react';
import { useSearchParams } from 'react-router-dom';

const ApprovalPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const purchaseRequestId = searchParams.get('purchase_request_id');
  const approverToken = searchParams.get('approver_token');

  return (
    <div>
      <h1>Página de Aprobación</h1>
      <p>ID de Solicitud: {purchaseRequestId}</p>
      <p>Token de Aprobador: {approverToken}</p>
      <p>Aquí se manejará el ingreso del OTP y la decisión de aprobación/rechazo.</p>
    </div>
  );
};

export default ApprovalPage;