// frontend/src/features/purchaseRequests/CreateRequestForm.tsx
import React, { useState } from 'react';
import apiClient from '../../services/apiClient';
import { useNavigate } from 'react-router-dom'; // Para redirigir después de crear

interface FormData {
  title: string;
  description: string;
  amount: string; // Usamos string para el input, luego convertimos a número
  approverEmails: string[];
}

const CreateRequestForm: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    amount: '',
    approverEmails: ['', '', ''],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleApproverEmailChange = (index: number, value: string) => {
    const newEmails = [...formData.approverEmails];
    newEmails[index] = value;
    setFormData((prev) => ({ ...prev, approverEmails: newEmails }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    const requesterEmail = localStorage.getItem('simulatedRequesterEmail');
    if (!requesterEmail) {
        setError("Error: Email del solicitante no configurado. Por favor, configúrelo en la barra de navegación.");
        setIsLoading(false);
        return;
    }

    // Validación básica (puedes mejorarla)
    if (formData.approverEmails.some(email => !email.includes('@')) || formData.approverEmails.length !== 3) {
        setError("Por favor, ingrese 3 correos de aprobadores válidos.");
        setIsLoading(false);
        return;
    }
    if (isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
        setError("Por favor, ingrese un monto válido y mayor a cero.");
        setIsLoading(false);
        return;
    }

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        amount: parseFloat(formData.amount),
        approverEmails: formData.approverEmails,
      };
      // La URL completa es baseURL (de apiClient) + /purchase-requests
      const response = await apiClient.post('/purchase-requests', payload);

      setSuccessMessage(`Solicitud creada exitosamente con ID: ${response.data.purchaseRequestId}`);
      // Limpiar formulario o redirigir
      setFormData({ title: '', description: '', amount: '', approverEmails: ['', '', ''] });
      // Opcional: redirigir al dashboard después de un momento
      setTimeout(() => {
        navigate('/'); 
      }, 2000);

    } catch (err: any) {
      console.error("Error al crear la solicitud:", err);
      setError(err.response?.data?.message || "Ocurrió un error al crear la solicitud.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '600px', margin: 'auto' }}>
      <h2>Crear Nueva Solicitud de Compra</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}

      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="title">Título:</label><br />
        <input
          type="text"
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          required
          style={{ width: '100%', padding: '8px' }}
        />
      </div>
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="description">Descripción:</label><br />
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          required
          style={{ width: '100%', padding: '8px', minHeight: '80px' }}
        />
      </div>
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="amount">Monto:</label><br />
        <input
          type="number"
          id="amount"
          name="amount"
          value={formData.amount}
          onChange={handleChange}
          required
          min="0.01"
          step="0.01"
          style={{ width: '100%', padding: '8px' }}
        />
      </div>
      {[0, 1, 2].map((index) => (
        <div key={index} style={{ marginBottom: '15px' }}>
          <label htmlFor={`approverEmail${index + 1}`}>Email Aprobador {index + 1}:</label><br />
          <input
            type="email"
            id={`approverEmail${index + 1}`}
            name={`approverEmail${index + 1}`}
            value={formData.approverEmails[index]}
            onChange={(e) => handleApproverEmailChange(index, e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
      ))}
      <button type="submit" disabled={isLoading} style={{ padding: '10px 20px' }}>
        {isLoading ? 'Creando...' : 'Crear Solicitud'}
      </button>
    </form>
  );
};

export default CreateRequestForm;