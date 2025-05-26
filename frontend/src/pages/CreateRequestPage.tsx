// frontend/src/pages/CreateRequestPage.tsx
import React from 'react';
import CreateRequestForm from '../features/purchaseRequests/CreateRequestForm';

const CreateRequestPage: React.FC = () => {
  return (
    <div>
      {/* <h1>Crear Nueva Solicitud de Compra</h1> */}
      {/* <p>Aquí estará el formulario para crear solicitudes.</p> */}
      <CreateRequestForm />
    </div>
  );
};

export default CreateRequestPage;