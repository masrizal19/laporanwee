import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, RefreshCw, AlertCircle, Loader2, Camera } from 'lucide-react';
import { findAppBySlug } from '../data/appsRegistry';
import { getStoredToken } from '../utils/api';

export interface AplikasiHostViewProps {
  appSlug: string;
  onBackToHub: () => void;
  onSessionExpired: () => void;
  onAddToast?: (text: string) => void;
}

type EmbedStatus = 'loading' | 'verifying' | 'ready' | 'error';

export const AplikasiHostView: React.FC<AplikasiHostViewProps> = ({
  appSlug,
  onBackToHub,
  onSessionExpired,
  onAddToast,
}) => {
  const app = findAppBySlug(appSlug);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const handshakeDoneRef = useRef<boolean>(false);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [embedStatus, setEmbedStatus] = useState<EmbedStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [reloadKey, setReloadKey] = useState<number>(0);

  const clearTimers = useCallback(() => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    if (readyDelayRef.current) {
      clearTimeout(readyDelayRef.current);
      readyDelayRef.current = null;
    }
  }, []);

  const sendAuthTokenToFrame = useCallback(() => {
    if (!app || !iframeRef.current?.contentWindow) return false;
    const token = getStoredToken();
    if (!token) {
      onAddToast?.('Sesi Anda telah berakhir. Silakan masuk kembali.');
      onSessionExpired();
      return false;
    }

    try {
      iframeRef.current.contentWindow.postMessage(
        { type: 'LAPORANWE_AUTH', token },
        app.trustedOrigin
      );
      return true;
    } catch (err) {
      console.error('[AplikasiHost] Gagal mengirim sinyal autentikasi ke frame:', err);
      return false;
    }
  }, [app, onAddToast, onSessionExpired]);

  // Verify existing LaporanWe session before mounting embedded app
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      onAddToast?.('Silakan masuk ke akun LaporanWe untuk membuka aplikasi.');
      onSessionExpired();
    }
  }, [onAddToast, onSessionExpired]);

  // Listen to cross-origin postMessage handshake from FOTOWE
  useEffect(() => {
    if (!app) return;

    handshakeDoneRef.current = false;
    setEmbedStatus('loading');
    setErrorMessage('');

    // Overall safeguard if iframe cannot be reached or is blocked by frame headers
    loadTimeoutRef.current = setTimeout(() => {
      if (!handshakeDoneRef.current) {
        setEmbedStatus('error');
        setErrorMessage(
          `Aplikasi ${app.name} tidak dapat dimuat di dalam frame. Periksa koneksi internet Anda atau pastikan server ${app.trustedOrigin} mengizinkan embed pada domain LaporanWe.`
        );
      }
    }, 9000);

    const handleMessage = (event: MessageEvent) => {
      // Strict origin check
      if (event.origin !== app.trustedOrigin) return;
      if (
        iframeRef.current?.contentWindow &&
        event.source !== iframeRef.current.contentWindow
      ) {
        return;
      }

      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'FOTOWE_AUTH_REQUEST') {
        handshakeDoneRef.current = true;
        clearTimers();
        setEmbedStatus('verifying');

        const sent = sendAuthTokenToFrame();
        if (sent) {
          readyDelayRef.current = setTimeout(() => {
            setEmbedStatus('ready');
          }, 450);
        }
      } else if (data.type === 'FOTOWE_AUTH_READY') {
        handshakeDoneRef.current = true;
        clearTimers();
        setEmbedStatus('ready');
      } else if (data.type === 'FOTOWE_AUTH_ERROR' || data.type === 'LAPORANWE_SESSION_EXPIRED') {
        clearTimers();
        setEmbedStatus('error');
        setErrorMessage(data.message || 'Verifikasi akun gagal atau sesi telah berakhir.');
        onAddToast?.('Sesi verifikasi gagal. Mengarahkan kembali ke login...');
        onSessionExpired();
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      clearTimers();
      window.removeEventListener('message', handleMessage);
    };
  }, [app, reloadKey, clearTimers, sendAuthTokenToFrame, onAddToast, onSessionExpired]);

  const handleIframeLoad = () => {
    if (!app) return;
    // Proactive handshake in case FOTOWE initialized before listener bound
    sendAuthTokenToFrame();

    // If iframe loaded an error page (e.g. X-Frame-Options block) without FOTOWE_AUTH_REQUEST,
    // wait briefly for postMessage and surface a clear fallback if none arrives.
    if (!handshakeDoneRef.current) {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = setTimeout(() => {
        if (!handshakeDoneRef.current) {
          setEmbedStatus('error');
          setErrorMessage(
            `Aplikasi ${app.name} menolak koneksi frame atau gagal verifikasi token. Coba muat ulang halaman ini.`
          );
        }
      }, 3500);
    }
  };

  const handleReload = () => {
    const token = getStoredToken();
    if (!token) {
      onSessionExpired();
      return;
    }
    handshakeDoneRef.current = false;
    setEmbedStatus('loading');
    setErrorMessage('');
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

      {/* Controlled Application Viewport */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden rounded-[26px] border border-[var(--line)] bg-white dark:bg-[#181622] shadow-[var(--shadow-card)]">
        {/* Loading / Verifying Overlay */}
        {(embedStatus === 'loading' || embedStatus === 'verifying') && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 dark:bg-[#181622]/90 backdrop-blur-md transition-opacity duration-200 px-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--dark)] text-[var(--on-dark)] shadow-md">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-[var(--ink)]">
              {embedStatus === 'verifying'
                ? `Memverifikasi sesi LaporanWe untuk ${app.name}...`
                : `Memuat ${app.name}...`}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Koneksi akun terintegrasi sedang disiapkan secara aman.
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

        {/* Controlled Iframe (Zero Token in URL) */}
        <iframe
          key={reloadKey}
          ref={iframeRef}
          src={app.sourceUrl}
          title={app.name}
          onLoad={handleIframeLoad}
          className="block h-full w-full border-0 flex-1"
          allow="clipboard-read; clipboard-write; fullscreen"
          loading="eager"
        />
      </div>
    </div>
  );
};

export default AplikasiHostView;
