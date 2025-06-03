// frontend/src/pages/MockMailsPage.tsx
import React, { useEffect, useState } from 'react';
import apiClient from '../services/apiClient';
import { Link } from 'react-router-dom'; // Para los links internos

interface MockMailData {
  approverEmail: string;
  purchaseRequestId: string;
  approverToken: string;
  // El approvalLink lo construiremos en el frontend
}

interface ConstructedMockMail extends MockMailData {
  approvalLink: string;
}

const MockMailsPage: React.FC = () => {
  const [mockMails, setMockMails] = useState<ConstructedMockMail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Obtener la URL base del frontend para construir los links
  // Esto asume que estás corriendo el frontend en el mismo dominio/puerto
  // o puedes obtenerlo de una variable de entorno si es diferente.
  const frontendBaseUrl = window.location.origin; 

  useEffect(() => {
    const fetchMockMails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // No se necesita X-Requester-Email para este endpoint de utilidad
        const response = await apiClient.get<MockMailData[]>('/mock-mail');

        const constructedMails = response.data.map(mail => ({
          ...mail,
          approvalLink: `<span class="math-inline">\{frontendBaseUrl\}/approve?purchase\_request\_id\=</span>{mail.purchaseRequestId}&approver_token=${mail.approverToken}`
        }));
        setMockMails(constructedMails);

      } catch (err: any) {
        console.error("Error al obtener los correos simulados:", err);
        setError(err.response?.data?.message || "Ocurrió un error al obtener los correos simulados.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMockMails();
  }, [frontendBaseUrl]); // Volver a ejecutar si frontendBaseUrl cambiara (aunque es poco probable aquí)

  if (isLoading) {
    return <p>Cargando correos simulados...</p>;
  }

  if (error) {
    return <p style={{ color: 'red' }}>Error: {error}</p>;
  }

  const listItemStyle: React.CSSProperties = {
    border: '1px solid #eee',
    padding: '10px',
    marginBottom: '10px',
    borderRadius: '5px',
    backgroundColor: '#f9f9f9'
  };

  const linkStyle: React.CSSProperties = {
    wordBreak: 'break-all' // Para que los links largos no rompan el layout
  };

  return (
    <div>
      <h1>Bandeja de Salida Simulada (Links de Aprobación)</h1>
      <p>Esta página muestra los links que se habrían enviado a los aprobadores. Úsalos para probar el flujo de aprobación.</p>
      {mockMails.length === 0 ? (
        <p>No hay correos simulados disponibles. Intenta crear algunas solicitudes de compra primero.</p>
      ) : (
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {mockMails.map((mail) => (
            <li key={mail.purchaseRequestId} style={listItemStyle}>
              <p><strong>Para:</strong> {mail.approverEmail}</p>
              <p><strong>ID Solicitud:</strong> {mail.purchaseRequestId}</p>
              <p><strong>Token Aprobador:</strong> {mail.approverToken}</p>
              <p>
                <strong>Link de Aprobación:</strong> <br />
                <Link to={`${frontendBaseUrl}/approve?purchase_request_id=${mail.purchaseRequestId}&approver_token=${mail.approverToken}`} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                    {`${frontendBaseUrl}/approve?purchase_request_id=${mail.purchaseRequestId}&approver_token=${mail.approverToken}`}
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MockMailsPage;