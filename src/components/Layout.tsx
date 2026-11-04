import React, { useState } from 'react';
import { VersionUpdateModal } from './VersionUpdateModal';

export interface LayoutProps {
  children?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [showModal, setShowModal] = useState<boolean>(() => {
    try {
      const seen =
        localStorage.getItem('laporanwee_v5_2_seen') ||
        localStorage.getItem('laporanwee_v5_2_notified');
      return seen !== 'true';
    } catch (_) {
      return false;
    }
  });

  return (
    <div className="layout-root w-full min-h-screen">
      {children}
      <VersionUpdateModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
};

export const MainLayout = Layout;
export default Layout;
