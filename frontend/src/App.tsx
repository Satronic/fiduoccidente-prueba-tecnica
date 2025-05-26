// frontend/src/App.tsx
import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import Navbar from './components/layout/Navbar';
import PageLayout from './components/layout/PageLayout';
// Podrías importar un archivo CSS global aquí si lo deseas
// import './App.css'; // o './styles/global.css'

const App: React.FC = () => {
  return (
    <Router>
      <Navbar />
      <PageLayout>
        <AppRoutes />
      </PageLayout>
    </Router>
  );
};

export default App;