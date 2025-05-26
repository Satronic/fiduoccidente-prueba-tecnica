// frontend/src/routes/AppRoutes.tsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import DashboardPage from '../pages/DashboardPage';
import CreateRequestPage from '../pages/CreateRequestPage';
import RequestDetailPage from '../pages/RequestDetailPage';
import ApprovalPage from '../pages/ApprovalPage';
import NotFoundPage from '../pages/NotFoundPage';

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/create-request" element={<CreateRequestPage />} />
      <Route path="/requests/:purchaseRequestId" element={<RequestDetailPage />} />
      <Route path="/approve" element={<ApprovalPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRoutes;