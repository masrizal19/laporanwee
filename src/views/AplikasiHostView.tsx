import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, RefreshCw, AlertCircle, Loader2, Camera } from 'lucide-react';
import { findAppBySlug } from '../data/appsRegistry';
import { getStoredToken, getStoredUser, profileService } from '../utils/api';

export interface AplikasiHostViewProps {
  appSlug: string;
  onBackToHub: () => void;
  onSessionExpired: () => void;
  onAddToast?: (text: string) => void;
}

type EmbedStatus = 'verifying' | 'loading' | 'ready' | 'error';

interface VerifiedAccount {
  id?: string | number;
  email?: string;
  full_name?: string;
  name?: string;
  role?: string;
}

export const AplikasiHostView: React.FC<AplikasiHostViewProps> = ({
  appSlug,
  onBackToHub,
  onSessionExpired,
  onAddToast,
}) => {
  const app = findAppBySlug(appSlug);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const verifiedUserRef = useRef<VerifiedAccount | null>(null);
  const frameReadyRef = useRef<boolean>(false);

  const [embedStatus, setEmbedStatus] = useState<EmbedStatus>('verifying');
  const [verifiedUser, setVerifiedUser] = useState<VerifiedAccount | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [reloadKey, setReloadKey] = useState<number>(0);

  const sameOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  const postAuthToFrame = useCallback(() => {
    if (!iframeRef.current?.contentWindow || !sameOrigin) return false;
    const token = getStoredToken();
    const account = verifiedUserRef.current;
    if (!token || !account) return false;

    try {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'LAPORANWE_AUTH',
          token,
          user: account,
          verified: true,
        },
        sameOrigin
      );
      return true;
    } catch (err) {
      console.error('[AplikasiHost] Gagal meneruskan sesi ke aplikasi:', err);
      return false;
    }
  }, [sameOrigin]);

  // Verify LaporanWe user session against backend API before exposing FOTOWE
  const verifySession = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      onAddToast?.('Silakan masuk ke akun LaporanWe untuk membuka aplikasi.');
      onSessionExpired();
      return;
    }

    frameReadyRef.current = false;
    verifiedUserRef.current = null;
    setVerifiedUser(null);
    setEmbedStatus('verifying');
    setErrorMessage('');

    try {
      const res = await profileService.getProfile();
      if (res && res.success && res.data) {
        const account: VerifiedAccount = {
          id: res.data.id,
          email: res.data.email || getStoredUser()?.email,
          full_name: res.data.full_name || getStoredUser()?.full_name,
          name: res.data.full_name || getStoredUser()?.name,
          role: res.data.role || getStoredUser()?.role,
        };
        verifiedUserRef.current = account;
        setVerifiedUser(account);
        setEmbedStatus('loading');
        return;
      }

      throw Object.assign(new Error(res?.message || 'Sesi akun tidak valid.'), { status: 401 });
    } catch (err: any) {
      if (err?.status === 401) {
        onAddToast?.('Sesi Anda telah berakhir. Silakan masuk kembali.');
        onSessionExpired();
        return;
      }

      // If network error occurs, fall back to cached session only if stored user & token exist,
      // otherwise surface explicit retry state.
      const cachedUser = getStoredUser();
      if (cachedUser && (cachedUser.id || cachedUser.email)) {
        const account: VerifiedAccount = {
          id: cachedUser.id,
          email: cachedUser.email,
          full_name: cachedUser.full_name,
          name: cachedUser.name,
          role: cachedUser.role,
        };
        verifiedUserRef.current = account;
        setVerifiedUser(account);
        setEmbedStatus('loading');
        return;
      }

      setEmbedStatus('error');
      setErrorMessage(
        err?.message || 'Gagal memverifikasi sesi LaporanWe. Periksa koneksi internet Anda lalu coba lagi.'
      );
    }
  }, [onAddToast, onSessionExpired]);

  useEffect(() => {
    if (!app) return;
    verifySession();
  }, [app, reloadKey, verifySession]);

  // Same-origin postMessage handshake with /fotowe/studio.html
  useEffect(() => {
    if (!app || !sameOrigin) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== sameOrigin) return;
      if (
        iframeRef.current?.contentWindow &&
        event.source !== iframeRef.current.contentWindow
      ) {
        return;
      }

      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'FOTOWE_AUTH_REQUEST') {
        postAuthToFrame();
      } else if (data.type === 'FOTOWE_AUTH_READY') {
        frameReadyRef.current = true;
        setEmbedStatus('ready');
      } else if (data.type === 'FOTOWE_AUTH_ERROR') {
        setEmbedStatus('error');
        setErrorMessage(data.message || 'Verifikasi akun gagal. Silakan masuk kembali ke LaporanWe.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [app, sameOrigin, postAuthToFrame]);

  // Safeguard if same-origin asset fails to send FOTOWE_AUTH_READY
  useEffect(() => {
    if (embedStatus !== 'loading') return;
    const timer = window.setTimeout(() => {
      if (!frameReadyRef.current) {
        postAuthToFrame();
      }
    }, 600);
    const failTimer = window.setTimeout(() => {
      if (!frameReadyRef.current) {
        setEmbedStatus('error');
        setErrorMessage(`Aplikasi ${app?.name || 'FOTOWE'} membutuhkan waktu terlalu lama untuk dimuat.`);
      }
    }, 8000);
    return () => {
      clearTimeout(timer);
      clearTimeout(failTimer);
    };
  }, [embedStatus, app?.name, postAuthToFrame]);

  const handleIframeLoad = () => {
    postAuthToFrame();
  };

  const handleReload = () => {
    const token = getStoredToken();
    if (!token) {
      onSessionExpired();
      return;
    }
    setReloadKey((k) => k + 1);
  };

  if (!app) {
    return (
      <div className="w-full max-w-[900px] mx-auto py-8">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--glass)] backdrop-blur-2xl p-10 text-center shadow-[var(--shadow-card)]">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-[var(--ink)]">Aplikasi tidak ditemukan</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Aplikasi &ldquo;{appSlug}&rdquo; belum terdaftar atau tidak tersedia di ekosistem LaporanWe.
          </p>
          <button
            type="button"
            onClick={onBackToHub}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--dark)] text-[var(--on-dark)] px-5 py-2.5 min-h-[42px] text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Kembali ke Aplikasi</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-152px)] md:h-[calc(100vh-84px)] max-h-[calc(100vh-84px)] flex flex-col min-w-0 min-h-0 overflow-hidden pr-0 sm:pr-2 pb-2">
      {/* Embedded App Top Control Bar */}
      <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--glass)] dark:bg-white/[0.05] backdrop-blur-xl px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToHub}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--glass-solid)] dark:bg-white/10 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-[var(--ink)] hover:opacity-85 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Kembali ke Aplikasi</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs text-[var(--muted)] min-w-0 truncate">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--ink)] whitespace-nowrap">
              <Camera className="h-3.5 w-3.5 text-[#ff3d6e]" aria-hidden="true" />
              {app.name}
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{app.category}</span>
            {verifiedUser?.email && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate opacity-80">{verifiedUser.email}</span>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleReload}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--glass-solid)] dark:bg-white/10 px-3.5 py-2 min-h-[38px] text-xs font-medium text-[var(--ink)] hover:opacity-85 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shrink-0"
          title={`Muat ulang ${app.name}`}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${embedStatus === 'loading' || embedStatus === 'verifying' ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>Muat Ulang</span>
        </button>
      </div>

      {/* Same-Origin Application Viewport */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden rounded-[26px] border border-[var(--line)] bg-[#f4f5f8] shadow-[var(--shadow-card)]">
        {/* Verifying / Loading Overlay */}
        {(embedStatus === 'verifying' || embedStatus === 'loading') && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#f4f5f8]/95 backdrop-blur-md transition-opacity duration-200 px-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1a1446] text-white shadow-md">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-[#1a1446]">
              {embedStatus === 'verifying'
                ? `Memverifikasi sesi LaporanWe untuk ${app.name}...`
                : `Menyiapkan Studio ${app.name}...`}
            </p>
            <p className="mt-1 text-xs text-[#5d5f75]">
              Menghubungkan akun Anda secara aman.
            </p>
          </div>
        )}

        {/* Error Fallback State */}
        {embedStatus === 'error' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[var(--bg2)] dark:bg-[#181622] px-6 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-[var(--ink)]">
              Gagal Memuat {app.name}
            </h2>
            <p className="mt-2 max-w-[48ch] text-sm text-[var(--muted)] leading-relaxed">
              {errorMessage}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleReload}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--dark)] text-[var(--on-dark)] px-5 py-2.5 min-h-[42px] text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Coba Lagi</span>
              </button>
              <button
                type="button"
                onClick={onBackToHub}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--glass-solid)] dark:bg-white/10 px-5 py-2.5 min-h-[42px] text-xs font-semibold text-[var(--ink)] cursor-pointer hover:opacity-85 transition-opacity whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Kembali ke Aplikasi</span>
              </button>
            </div>
          </div>
        )}

        {/* Mount Same-Origin FOTOWE Studio once account session is verified */}
        {verifiedUser && (
          <iframe
            key={reloadKey}
            ref={iframeRef}
            src={app.sourceUrl}
            title={`${app.name} — Studio Pas Foto Digital`}
            onLoad={handleIframeLoad}
            className="block h-full w-full border-0 flex-1 bg-[#f4f5f8]"
            allow="clipboard-read; clipboard-write; fullscreen"
            loading="eager"
          />
        )}
      </div>
    </div>
  );
};

export default AplikasiHostView;
