// frontend/src/components/layout/PageLayout.tsx
import React from 'react';

interface PageLayoutProps {
  children: React.ReactNode;
}

const PageLayout: React.FC<PageLayoutProps> = ({ children }) => {
  return (
    <div style={{ margin: '20px' }}>
      {children}
    </div>
  );
};

export default PageLayout;