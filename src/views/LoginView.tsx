import React, { useState, useEffect, useRef } from 'react';
import '../auth.css';
import { buildApiUrl, setStoredToken, setStoredUser, extractAvatarFromResponse, withAvatarCacheBust } from '../utils/api';
import { resendVerificationEmail } from '../utils/authService';

interface LoginViewProps {
  onLoginSuccess: (email: string, name: string, fullUser?: any) => void;
  onNavigateToRegister: () => void;
  logoUrl?: string | null;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  onNavigateToRegister,
  logoUrl,
}) => {
  const [email, setEmail] = useState(() => {
    return localStorage.getItem('laporanwee_registered_email') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Email Unverified States
  const [isUnverified, setIsUnverified] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccessMsg, setResendSuccessMsg] = useState('');
  const [resendErrorMsg, setResendErrorMsg] = useState('');

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passInputRef = useRef<HTMLInputElement>(null);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      setErrorMsg('Harap isi E-Mail dan Password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setIsUnverified(false);
    setResendSuccessMsg('');
    setResendErrorMsg('');

    const loginUrl = buildApiUrl('/login.php');

    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password: password,
        }),
      });

      const text = await response.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Server mengembalikan response tidak valid (${response.status})`);
      }

      const code = String(data.code || data.error_code || '').toUpperCase();
      const rawMsg = String(data.message || data.error || '');
      const lowerMsg = rawMsg.toLowerCase();
      const isEmailVerified = data.email_verified !== false && data.user?.email_verified !== false;

      const isEmailNotVerified =
        code === 'EMAIL_NOT_VERIFIED' ||
        data.email_verified === false ||
        data.user?.email_verified === false ||
        response.status === 403 ||
        lowerMsg.includes('belum diverifikasi') ||
        lowerMsg.includes('not verified') ||
        lowerMsg.includes('verifikasi email');

      if (isEmailNotVerified) {
        setIsLoading(false);
        setIsUnverified(true);
        setUnverifiedEmail(trimmedEmail);
        setErrorMsg('');
        return;
      }

      if (!response.ok || data.success === false) {
        throw new Error(data.message || data.error || 'Email atau password tidak sesuai.');
      }

      setIsLoading(false);

      const token =
        data.token ||
        data.access_token ||
        data.auth_token ||
        data.session_token ||
        data.bearer_token ||
        data.jwt ||
        data.data?.token ||
        data.data?.access_token ||
        data.data?.auth_token ||
        data.data?.session_token ||
        data.user?.token ||
        data.user?.access_token ||
        '';

      if (!token || token === 'session-active-token') {
        throw new Error(data.message || 'Server tidak mengembalikan token autentikasi yang valid.');
      }

      setStoredToken(token);

      const rawUser = data.user || data.data?.user || data.data || {};
      const idVal = rawUser.id || rawUser.user_id || 1;
      const emailVal = rawUser.email || trimmedEmail;
      const nameVal = rawUser.full_name || rawUser.name || trimmedEmail.split('@')[0];
      const roleVal = rawUser.role || 'team';
      const statusVal = rawUser.status || 'active';
      const rawAvatar = extractAvatarFromResponse(data);
      const avatarVal = rawAvatar ? withAvatarCacheBust(rawAvatar) : null;

      const userObj = {
        id: idVal,
        full_name: rawUser.full_name || nameVal,
        name: nameVal,
        email: emailVal,
        role: roleVal,
        status: statusVal,
        avatar_url: avatarVal,
        email_verified: isEmailVerified,
      };

      setStoredUser(userObj);
      if (rememberMe) {
        localStorage.setItem('laporanwee_registered_email', trimmedEmail);
      }

      setIsSuccess(true);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'Email atau password tidak sesuai.');
    }
  };

  const handleResendVerification = async () => {
    const targetEmail = (unverifiedEmail || email).trim().toLowerCase();
    if (!targetEmail || resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setResendSuccessMsg('');
    setResendErrorMsg('');

    try {
      const res = await resendVerificationEmail(targetEmail);
      setResendSuccessMsg(res.message || 'Email verifikasi berhasil dikirim ulang.');
      setResendCooldown(60);
    } catch (err: any) {
      setResendErrorMsg(err?.message || 'Gagal mengirim ulang email verifikasi.');
    } finally {
      setIsResending(false);
    }
  };

  const handleProceed = () => {
    const storedUser = localStorage.getItem('laporanwee_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        onLoginSuccess(parsed.email, parsed.name, parsed);
        return;
      } catch (_) {}
    }
    const trimmedEmail = email.trim();
    onLoginSuccess(trimmedEmail, trimmedEmail.split('@')[0] || 'User');
  };

  const handleDemoFill = () => {
    setEmail('admin@gmail.com');
    setPassword('rizal12345');
    setErrorMsg('');
    passInputRef.current?.focus();
  };

  return (
    <div className="auth-body">
      {/* Ambient Drifting Blobs */}
      <div className="ambient">
        <i></i><i></i><i></i>
      </div>

      <main className="stage" id="stage">
        {/* Left Mini Side Tab */}
        <aside className="side">
          <div className="logo-box">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                style={{ width: '28px', height: '28px', objectFit: 'contain' }}
              />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13c3-6 11-6 14 0M8 17c2-3 6-3 8 0" />
              </svg>
            )}
          </div>

          <div className="tabs" role="tablist">
            <div className="pill" style={{ transform: 'translateY(0px)' }} />
            <button className="tab on" role="tab" type="button" aria-selected="true">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              Masuk
            </button>
            <button
              className="tab"
              role="tab"
              type="button"
              onClick={onNavigateToRegister}
              aria-selected="false"
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="10" cy="8" r="3.5" />
                <path d="M3 20a7 7 0 0 1 14 0M19 8v6M16 11h6" />
              </svg>
              Daftar
            </button>
          </div>

          <div className="by">LaporanWee v5.0</div>
        </aside>

        {/* Art Panel Illustration */}
        <section className="art" aria-hidden="true">
          <span className="badge-tag">
            <i /> LaporanWee v5.0
          </span>
          <div className="copy">
            <h2>Jangan lupa kerja hari ini</h2>
            <p>Catat progres kreatif tim dalam satu tempat terpusat setiap hari.</p>
          </div>
          <div className="scene">
            <div className="fc fc1">
              <small>Rebranding Kopi Nusa</small>
              <b>Progres desain</b>
              <div className="bar-fill">
                <i style={{ width: '78%' }} />
              </div>
            </div>
            <div className="fc fc2">
              <small>Laporan hari ini</small>
              <b>Terkirim</b>
              <div className="av">
                <i style={{ background: '#e3ddfa' }}>Ri</i>
                <i style={{ background: '#e9f5b8' }}>Di</i>
                <i style={{ background: '#f6e6cf' }}>Sa</i>
                <i style={{ background: '#d6ecdf' }}>+5</i>
              </div>
            </div>
            <div className="fc fc3">
              <svg className="mini-ring" viewBox="0 0 48 48">
                <circle className="a" cx="24" cy="24" r="20" />
                <circle className="b" cx="24" cy="24" r="20" />
              </svg>
              <div>
                <small>Tingkat selesai</small>
                <b style={{ margin: 0 }}>82%</b>
              </div>
            </div>
          </div>
        </section>

        {/* Form Panel */}
        <section className="formp">
          <div className="switch-top">
            Belum punya akun?
            <a onClick={onNavigateToRegister}>Daftar</a>
          </div>

          <div className="screens">
            {isSuccess ? (
              <div className="scr">
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <svg className="okc-box" viewBox="0 0 104 104" style={{ margin: '0 auto 20px' }}>
                    <circle cx="52" cy="52" r="48" />
                    <path d="m32 54 14 14 27-30" />
                  </svg>
                  <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Berhasil Masuk!</h1>
                  <p className="lead" style={{ marginBottom: '24px' }}>
                    Selamat datang kembali di LaporanWee Studio.
                  </p>
                  <button
                    className="btn-auth-main"
                    type="button"
                    onClick={handleProceed}
                  >
                    <span>Masuk ke Dashboard</span>
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : isUnverified ? (
              <div className="scr">
                <div className="env-box">
                  <div className="ring-breathe" />
                  <svg viewBox="0 0 24 24">
                    <rect x="3" y="5" width="18" height="14" rx="3" />
                    <path d="m4 8 8 6 8-6" />
                  </svg>
                </div>
                <h1>Periksa email Anda</h1>
                <p className="lead" style={{ marginBottom: '6px' }}>
                  Akun Anda belum diverifikasi. Link aktivasi telah dikirim ke:
                </p>
                <div>
                  <span className="mailto-box">{unverifiedEmail || email}</span>
                </div>

                {resendSuccessMsg && (
                  <div style={{ color: 'var(--ok)', fontSize: '13px', marginBottom: '12px', fontWeight: 600 }}>
                    ✓ {resendSuccessMsg}
                  </div>
                )}
                {resendErrorMsg && (
                  <div style={{ color: 'var(--bad)', fontSize: '13px', marginBottom: '12px', fontWeight: 600 }}>
                    {resendErrorMsg}
                  </div>
                )}

                <button
                  className="btn-auth-main"
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendCooldown > 0 || isResending}
                >
                  <span>
                    {isResending
                      ? 'Mengirim ulang...'
                      : resendCooldown > 0
                      ? `Kirim ulang dalam ${resendCooldown}s`
                      : 'Kirim Ulang Link Verifikasi'}
                  </span>
                  <i className="sp" />
                </button>

                <div className="resend-box">
                  Sudah verifikasi?{' '}
                  <button type="button" onClick={() => setIsUnverified(false)}>
                    Coba Masuk Lagi
                  </button>
                </div>
              </div>
            ) : (
              <form className="scr" onSubmit={handleSignIn} noValidate>
                <h1>Masuk</h1>
                <p className="lead">Selamat datang kembali. Lanjutkan pekerjaan Anda.</p>

                <div className={`fld ${errorMsg && !email ? 'bad' : ''}`}>
                  <label htmlFor="login-email">E-Mail</label>
                  <div className="inp">
                    <input
                      id="login-email"
                      ref={emailInputRef}
                      type="email"
                      placeholder="admin@laporanwee.agency"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setErrorMsg('');
                      }}
                    />
                    <span className="ic">
                      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="5" width="18" height="14" rx="3" />
                        <path d="m4 8 8 6 8-6" />
                      </svg>
                    </span>
                  </div>
                </div>

                <div className={`fld ${errorMsg ? 'bad' : ''}`}>
                  <label htmlFor="login-pass">Password</label>
                  <div className="inp">
                    <input
                      id="login-pass"
                      ref={passInputRef}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrorMsg('');
                      }}
                    />
                    <button
                      type="button"
                      className="ic eye"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 4-.9M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {errorMsg && <div className="err" style={{ maxHeight: '30px', opacity: 1, marginTop: '6px' }}>{errorMsg}</div>}
                </div>

                <div className="opts">
                  <label>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span className="box">
                      <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 12 4.5 4.5L19 7" />
                      </svg>
                    </span>
                    Ingat saya
                  </label>
                  <a>Lupa password?</a>
                </div>

                <button
                  className={`btn-auth-main ${isLoading ? 'load' : ''}`}
                  type="submit"
                >
                  <span>Masuk</span>
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                  <i className="sp" />
                </button>

                <p className="terms-auth">
                  Dengan masuk, Anda menyetujui Kebijakan Privasi LaporanWee.
                </p>

                <div className="demo-auth-box">
                  <div>
                    <b>Akun demo</b>
                    <span>admin@gmail.com · rizal12345</span>
                  </div>
                  <button type="button" onClick={handleDemoFill}>
                    Isi otomatis
                  </button>
                </div>
              </form>
            )}
          </div>

          <p className="foot-auth">LaporanWee v5.0 • Jangan lupa kerja hari ini</p>
        </section>
      </main>
    </div>
  );
};
