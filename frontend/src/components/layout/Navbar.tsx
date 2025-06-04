// frontend/src/components/layout/Navbar.tsx
import React from 'react';
import { Link } from 'react-router-dom';

// Componente para simular la configuración del X-Requester-Email
const SimulatedUserSetter: React.FC = () => {
  const [email, setEmail] = React.useState(localStorage.getItem('simulatedRequesterEmail') || '');

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
  };

  const handleSetEmail = () => {
    if (email) {
      localStorage.setItem('simulatedRequesterEmail', email);
      alert(`Solicitante simulado configurado como: ${email}. Es posible que necesites recargar la página o las listas para ver los cambios reflejados en las llamadas API.`);
    } else {
      localStorage.removeItem('simulatedRequesterEmail');
      alert('Email del solicitante simulado eliminado. Se usará el valor por defecto o ninguno.');
    }
  };

  return (
    <div style={{ padding: '5px 10px', background: '#eee', borderBottom: '1px solid #ccc', marginBottom: '10px', fontSize: '0.9em' }}>
      <label htmlFor="requesterEmailInput" style={{ marginRight: '5px' }}>Simular Email Solicitante (Header X-Requester-Email):</label>
      <input
        type="email"
        id="requesterEmailInput"
        value={email}
        onChange={handleChange}
        placeholder="ej. solicitante@example.com"
        size={30}
        style={{ marginRight: '5px' }}
      />
      <button onClick={handleSetEmail}>Configurar/Limpiar</button>
    </div>
  );
};


const Navbar: React.FC = () => {
  return (
    <>
      <nav style={{ background: '#333', padding: '10px', color: 'white' }}>
        <Link to="/" style={{ color: 'white', marginRight: '15px', textDecoration: 'none' }}>
          Solicitudes
        </Link>
        <Link to="/create-request" style={{ color: 'white', textDecoration: 'none' }}>
          Crear Solicitud
        </Link>
        <Link to="/mock-mails" style={{ color: 'white', textDecoration: 'none', marginLeft: 10 }}>
          Enlaces de Aprobación
        </Link>

      </nav>
      <SimulatedUserSetter /> {/* Añadimos el configurador de email aquí */}
    </>
  );
};

export default Navbar;