import React, { useEffect, useState } from 'react';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { findAppBySlug } from '../data/appsRegistry';
import { profileService } from '../utils/api';
import { getActiveToken } from '../utils/fotoweApi';
import { AuthUser } from '../types';
import { FotoweFullscreenView } from './FotoweFullscreenView';
import '../styles/fotowe.css';

export interface AplikasiHostViewProps {
  appSlug: string;
  currentUser?: AuthUser | null;
  onBackToHub: () => void;
  onSessionExpired: () => void;
  onAddToast?: (text: string) => void;
}

export const AplikasiHostView: React.FC<AplikasiHostViewProps> = ({
  appSlug,
  currentUser,
  onBackToHub,
  onSessionExpired,
  onAddToast,
}) => {
  const app = findAppBySlug(appSlug);
  const [verifiedAccount, setVerifiedAccount] = useState<{
    id?: string | number;
    email?: string;
  } | null>(() =>
    currentUser
      ? { id: currentUser.id, email: currentUser.email }
      : null
  );

  // Sync verified identity and validate token cleanly without iframe handshakes
  useEffect(() => {
    if (!app) return;
    const token = getActiveToken();
    if (!token) {
      onAddToast?.('Silakan masuk ke akun LaporanWe untuk membuka aplikasi.');
      onSessionExpired();
      return;
    }

    let active = true;
    profileService
      .getProfile()
      .then((res) => {
        if (!active) return;
        if (res && res.success && res.data) {
          setVerifiedAccount({
            id: res.data.id ?? currentUser?.id,
            email: res.data.email ?? currentUser?.email,
          });
        }
      })
      .catch((err: any) => {
        if (!active) return;
        if (err?.status === 401) {
          onAddToast?.('Sesi Anda telah berakhir. Silakan masuk kembali.');
          onSessionExpired();
        }
      });

    return () => {
      active = false;
    };
  }, [app, currentUser?.id, currentUser?.email, onAddToast, onSessionExpired]);

  if (!app) {
    return (
      <div className="fotowe-fullscreen-shell items-center justify-center p-6">
        <div className="w-full max-w-[460px] rounded-2xl border border-[rgba(20,20,60,0.12)] bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff3d6e]/10 text-[#ff3d6e]">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="!text-xl !font-extrabold !tracking-tight text-[#1a1446]">
            Aplikasi tidak ditemukan
          </h1>
          <p className="mt-2 text-sm text-[#5d5f75] leading-relaxed">
            Aplikasi &ldquo;{appSlug}&rdquo; belum terdaftar atau tidak tersedia di ekosistem LaporanWe.
          </p>
          <a
            href="/Aplikasi"
            onClick={(e) => {
              e.preventDefault();
              onBackToHub();
            }}
            className="back-laporanwe mt-6 inline-flex"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Kembali ke LaporanWe</span>
          </a>
        </div>
      </div>
    );
  }

  const activeUserId = verifiedAccount?.id ?? currentUser?.id;
  const activeUserEmail = verifiedAccount?.email ?? currentUser?.email;
  const accountKey = String(activeUserId ?? activeUserEmail ?? 'anon');

  return (
    <FotoweFullscreenView
      key={accountKey}
      userId={activeUserId}
      userEmail={activeUserEmail}
      onBackToHub={onBackToHub}
    />
  );
};

export default AplikasiHostView;
