// frontend/src/pages/DashboardPage.tsx
import React from 'react';
import { Link } from 'react-router-dom'; // Link para el botón de "Crear Nueva Solicitud"
import RequestList from '../features/purchaseRequests/RequestList'; // Importa el nuevo componente

const DashboardPage: React.FC = () => {
  return (
    <div>
      <h1>Mis Solicitudes de Compra</h1>
      <RequestList /> {/* Renderiza el componente de la lista aquí */}
      <br />
      <Link to="/create-request">
        <button style={{ padding: '10px 15px', marginTop: '20px' }}>Crear Nueva Solicitud</button>
      </Link>
    </div>
  );
};

export default DashboardPage;