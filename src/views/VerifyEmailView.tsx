import React, { useState, useEffect } from 'react';
import '../auth.css';
import {
  verifyEmailToken,
  resendVerificationEmail,
  VerifyEmailStatus,
  maskEmail,
} from '../utils/authService';

interface VerifyEmailViewProps {
  onNavigateToLogin: () => void;
  onAddToast?: (msg: string) => void;
}

export const VerifyEmailView: React.FC<VerifyEmailViewProps> = ({
  onNavigateToLogin,
  onAddToast,
}) => {
  const [status, setStatus] = useState<VerifyEmailStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [customResendEmail, setCustomResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccessMsg, setResendSuccessMsg] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Extract email and token from query params or hash
  useEffect(() => {
    let email = '';
    let token = '';

    // 1. Search in URL query string (window.location.search)
    if (window.location.search) {
      const params = new URLSearchParams(window.location.search);
      email = params.get('email') || '';
      token = params.get('token') || '';
    }

    // 2. Fallback: Search in hash if using hash routing or query parameters in hash
    if ((!email || !token) && window.location.hash.includes('?')) {
      const hashQuery = window.location.hash.split('?')[1];
      const params = new URLSearchParams(hashQuery);
      if (!email) email = params.get('email') || '';
      if (!token) token = params.get('token') || '';
    }

    // 3. Fallback: Parse whole href if needed
    if (!email || !token) {
      try {
        const fullUrl = new URL(window.location.href);
        if (!email) email = fullUrl.searchParams.get('email') || '';
        if (!token) token = fullUrl.searchParams.get('token') || '';
      } catch {
        // ignore
      }
    }

    email = email.trim();
    token = token.trim();

    if (email) {
      setUserEmail(email);
      setCustomResendEmail(email);
    }

    if (!email && !token) {
      setStatus('invalid');
      setErrorMessage('Parameter email dan token verifikasi tidak ditemukan dalam URL.');
      return;
    }

    if (!email) {
      setStatus('invalid');
      setErrorMessage('Parameter email verifikasi tidak ditemukan dalam URL.');
      return;
    }

    if (!token) {
      setStatus('invalid');
      setErrorMessage('Token verifikasi tidak ditemukan dalam URL.');
      return;
    }

    let isMounted = true;
    setStatus('loading');

    verifyEmailToken(email, token)
      .then((res) => {
        if (!isMounted) return;
        setStatus(res.status);
        const resolvedEmail = res.email || email;
        if (resolvedEmail) {
          setUserEmail(resolvedEmail);
          setCustomResendEmail(resolvedEmail);
        }
        if (res.status === 'success' || res.status === 'already_verified') {
          if (resolvedEmail) {
            localStorage.setItem('laporanwee_registered_email', resolvedEmail);
          }
        }
        if (res.message) {
          setErrorMessage(res.message);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setStatus('error');
        setErrorMessage(
          typeof err?.message === 'string'
            ? err.message
            : 'Terjadi kendala saat memverifikasi akun Anda.'
        );
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    const targetEmail = (customResendEmail || userEmail).trim().toLowerCase();
    if (!targetEmail) {
      const msg = 'Masukkan alamat email Anda terlebih dahulu.';
      setErrorMessage(msg);
      if (onAddToast) onAddToast(msg);
      return;
    }

    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setResendSuccessMsg('');
    setErrorMessage('');

    try {
      await resendVerificationEmail(targetEmail);
      setResendSuccessMsg('Email verifikasi berhasil dikirim ulang.');
      setResendCooldown(60);
      if (onAddToast) onAddToast('Email verifikasi berhasil dikirim ulang.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal mengirim ulang email verifikasi.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="auth-body">
      <div className="verify-card-container">
        <div className="verify-card">
          {/* Logo brand */}
          <div className="verify-card-header">
            <div className="logo-auth" style={{ opacity: 1, margin: '0 auto 18px' }}></div>
          </div>

          {/* 1. LOADING STATE */}
          {status === 'loading' && (
            <div className="verify-content fade-in">
              <div className="verify-spinner-wrap">
                <div className="verify-spinner"></div>
              </div>
              <h2 className="verify-title">Memverifikasi Email...</h2>
              <p className="verify-desc">
                Mohon tunggu beberapa saat selagi sistem memverifikasi akun Anda.
              </p>
            </div>
          )}

          {/* 2. SUCCESS STATE */}
          {status === 'success' && (
            <div className="verify-content fade-in">
              <div className="verify-icon-badge success">
                <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h2 className="verify-title">Email Berhasil Diverifikasi</h2>
              <p className="verify-desc">
                Email Anda telah berhasil diverifikasi dan akun sudah dapat digunakan untuk login.
              </p>
              {userEmail && (
                <div className="verify-email-chip">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 14, height: 14 }}>
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 7l9 6 9-6" />
                  </svg>
                  <span>{maskEmail(userEmail)}</span>
                </div>
              )}
              <div className="verify-action-stack">
                <button
                  type="button"
                  className="btn-verify-primary"
                  onClick={onNavigateToLogin}
                >
                  Login
                </button>
              </div>
            </div>
          )}

          {/* 3. ALREADY VERIFIED STATE */}
          {status === 'already_verified' && (
            <div className="verify-content fade-in">
              <div className="verify-icon-badge info">
                <svg viewBox="0 0 24 24" fill="none" stroke="#4a5cf5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <h2 className="verify-title">Email Sudah Diverifikasi</h2>
              <p className="verify-desc">
                Email Anda sudah terverifikasi sebelumnya dan akun sudah dapat digunakan untuk login.
              </p>
              {userEmail && (
                <div className="verify-email-chip">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 14, height: 14 }}>
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 7l9 6 9-6" />
                  </svg>
                  <span>{maskEmail(userEmail)}</span>
                </div>
              )}
              <div className="verify-action-stack">
                <button
                  type="button"
                  className="btn-verify-primary"
                  onClick={onNavigateToLogin}
                >
                  Login
                </button>
              </div>
            </div>
          )}

          {/* 4. EXPIRED STATE */}
          {status === 'expired' && (
            <div className="verify-content fade-in">
              <div className="verify-icon-badge warning">
                <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <h2 className="verify-title">Link Verifikasi Kedaluwarsa</h2>
              <p className="verify-desc">
                Link verifikasi ini sudah tidak berlaku. Silakan kirim ulang email verifikasi untuk mengaktifkan akun Anda.
              </p>

              {resendSuccessMsg && (
                <div className="verify-alert success">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span>{resendSuccessMsg}</span>
                </div>
              )}

              {errorMessage && (
                <div className="verify-alert error">
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="verify-form-group">
                <label htmlFor="resendEmailInput">Alamat Email</label>
                <input
                  id="resendEmailInput"
                  type="email"
                  className="verify-input"
                  placeholder="name@agency.com"
                  value={customResendEmail}
                  onChange={(e) => setCustomResendEmail(e.target.value)}
                />
              </div>

              <div className="verify-action-stack">
                <button
                  type="button"
                  className="btn-verify-primary"
                  onClick={handleResend}
                  disabled={isResending || resendCooldown > 0}
                >
                  {isResending
                    ? 'Mengirim...'
                    : resendCooldown > 0
                    ? `Kirim ulang dalam ${resendCooldown} detik`
                    : 'Kirim Ulang Email'}
                </button>
                <button
                  type="button"
                  className="btn-verify-ghost"
                  onClick={onNavigateToLogin}
                >
                  Kembali ke Login
                </button>
              </div>
            </div>
          )}

          {/* 5. INVALID OR GENERAL ERROR STATE */}
          {(status === 'invalid' || status === 'error') && (
            <div className="verify-content fade-in">
              <div className="verify-icon-badge danger">
                <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <h2 className="verify-title">
                {status === 'invalid' ? 'Link Verifikasi Tidak Valid' : 'Terjadi Kendala Verifikasi'}
              </h2>
              <p className="verify-desc">
                {errorMessage ||
                  'Token verifikasi tidak ditemukan atau tidak valid. Silakan periksa link di email Anda atau kirim ulang verifikasi.'}
              </p>

              {resendSuccessMsg && (
                <div className="verify-alert success">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span>{resendSuccessMsg}</span>
                </div>
              )}

              <div className="verify-form-group">
                <label htmlFor="invalidResendEmail">Kirim ulang link verifikasi ke:</label>
                <input
                  id="invalidResendEmail"
                  type="email"
                  className="verify-input"
                  placeholder="Masukkan email Anda"
                  value={customResendEmail}
                  onChange={(e) => setCustomResendEmail(e.target.value)}
                />
              </div>

              <div className="verify-action-stack">
                <button
                  type="button"
                  className="btn-verify-primary"
                  onClick={handleResend}
                  disabled={isResending || resendCooldown > 0}
                >
                  {isResending
                    ? 'Mengirim...'
                    : resendCooldown > 0
                    ? `Kirim ulang dalam ${resendCooldown} detik`
                    : 'Kirim Ulang Email'}
                </button>
                <button
                  type="button"
                  className="btn-verify-ghost"
                  onClick={onNavigateToLogin}
                >
                  Kembali ke Login
                </button>
              </div>
            </div>
          )}

          <div className="verify-card-footer">
            <span>LaporanWee &bull; Sistem Verifikasi Akun Pengguna</span>
          </div>
        </div>
      </div>
    </div>
  );
};
