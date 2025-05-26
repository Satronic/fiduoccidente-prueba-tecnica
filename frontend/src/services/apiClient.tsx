// frontend/src/services/apiClient.ts
import axios from 'axios';

// Obtén la URL base de tu API Gateway desde una variable de entorno o configúrala directamente
// Asegúrate de que incluya el 'stage' (ej. /dev o /prod)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://ojk7frnju0.execute-api.us-east-1.amazonaws.com/dev'; 
// Si usas Create React App, sería process.env.REACT_APP_API_BASE_URL

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para añadir el X-Requester-Email a todas las solicitudes
apiClient.interceptors.request.use(
  (config) => {
    const requesterEmail = localStorage.getItem('simulatedRequesterEmail');
    if (requesterEmail && config.headers) {
      config.headers['X-Requester-Email'] = requesterEmail;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;