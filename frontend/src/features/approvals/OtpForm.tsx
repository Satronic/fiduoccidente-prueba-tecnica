// frontend/src/features/approvals/OtpForm.tsx
import React, { useState } from 'react';

interface OtpFormProps {
  onSubmitOtp: (otp: string) => void; // Función para llamar cuando se envía el OTP
  isLoading: boolean; // Para deshabilitar el botón mientras se procesa
  error?: string | null; // Para mostrar mensajes de error del backend
}

const OtpForm: React.FC<OtpFormProps> = ({ onSubmitOtp, isLoading, error }) => {
  const [otp, setOtp] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (otp.trim().length === 6 && !isLoading) { // Validación básica de longitud
      onSubmitOtp(otp);
    } else if (otp.trim().length !== 6) {
        // Podrías manejar este error localmente o dejar que el backend lo haga
        alert("El OTP debe tener 6 dígitos.");
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h3>Verificación de OTP</h3>
      <p>Se ha generado un OTP. Por favor, ingréselo a continuación (para esta prueba, revíselo en los logs de CloudWatch de la función GetApprovalInfoFunction).</p>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="otpInput" style={{ display: 'block', marginBottom: '5px' }}>Código OTP de 6 dígitos:</label>
        <input
          type="text" // Usar text para permitir pegar, pero podrías añadir pattern="[0-9]*"
          id="otpInput"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').substring(0, 6))} // Permitir solo dígitos, max 6
          maxLength={6}
          minLength={6}
          required
          style={{ width: '100%', padding: '10px', fontSize: '1.2em', textAlign: 'center', letterSpacing: '0.5em' }}
          placeholder="______"
        />
      </div>
      <button type="submit" disabled={isLoading || otp.length !== 6} style={{ padding: '10px 20px', width: '100%' }}>
        {isLoading ? 'Validando OTP...' : 'Validar OTP'}
      </button>
    </form>
  );
};

export default OtpForm;