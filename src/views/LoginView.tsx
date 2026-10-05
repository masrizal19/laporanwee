import React, { useState, useEffect, useRef } from 'react';
import '../auth.css';
import { API_BASE_URL, buildApiUrl, setStoredToken, setStoredUser } from '../utils/api';
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
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isFocusEmail, setIsFocusEmail] = useState(false);
  const [isFocusPass, setIsFocusPass] = useState(false);

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
    console.log('[Login] URL Request:', loginUrl);
    // Safe debugging log (never log plain password)
    console.log('[Login] Mengirim permintaan login ke server:', {
      url: loginUrl,
      payload: {
        email: trimmedEmail,
        password: '***',
      },
    });

    try {
      // Direct POST request to PHP MySQL backend using VITE_API_URL base
      console.log('[API REQUEST]', { method: 'POST', url: loginUrl });
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

      // Safe text-then-parse response pattern
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

      // Check if backend returned EMAIL_NOT_VERIFIED or email_verified === false or HTTP 403
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

      // Extract real Bearer token returned by backend
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
        console.error('[AUTH ERROR] Login response did not contain a valid token:', data);
        throw new Error(data.message || 'Server tidak mengembalikan token autentikasi yang valid.');
      }

      setStoredToken(token);

      const rawUser = data.user || data.data?.user || data.data || {};
      const idVal = rawUser.id || rawUser.user_id || 1;
      const emailVal = rawUser.email || trimmedEmail;
      const nameVal = rawUser.full_name || rawUser.name || trimmedEmail.split('@')[0];
      const roleVal = rawUser.role || 'team';
      const statusVal = rawUser.status || 'active';
      const avatarVal = rawUser.avatar_url || rawUser.profile_photo || '';

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

      console.log('[AUTH] Current user:', {
        id: userObj.id,
        email: userObj.email,
        role: userObj.role,
      });

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

  return (
    <div className="auth-body">
      <div className={`stage ${isSuccess ? 'success' : ''}`} id="stage">
        {/* Left Sidebar */}
        <div className="sidebar">
          {logoUrl ? (
            <div style={{ width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={logoUrl}
                alt="Logo"
                style={{ maxWidth: '38px', maxHeight: '38px', objectFit: 'contain' }}
              />
            </div>
          ) : (
            <div className="logo-auth"></div>
          )}
          <div className="side-nav">
            <button className="nav-item-auth active" type="button" aria-label="Sign In">
              <span className="icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="#4a5cf5" strokeWidth="1.8">
                  <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </span>
              <span>Sign In</span>
            </button>
            <button
              className="nav-item-auth"
              type="button"
              onClick={onNavigateToRegister}
              aria-label="Sign Up"
            >
              <span className="icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="#8b8fb3" strokeWidth="1.8">
                  <circle cx="9" cy="8" r="3.2" />
                  <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                  <path d="M16 11l2 2 3.5-3.5" />
                </svg>
              </span>
              <span>Sign Up</span>
            </button>
          </div>
        </div>

        {/* Middle Illustration Column */}
        <div className="illustration">
          <h1>Start Your<br />Journey.</h1>
          <p>Catat progres kreatif tim terpusat harian.</p>
          <div className="art">
            <div className="badge-auth">
              <svg viewBox="0 0 24 24" fill="none" stroke="#4a5cf5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12l5 5L20 6" />
              </svg>
            </div>
            <svg viewBox="0 0 300 230" fill="none">
              <rect x="30" y="70" width="200" height="140" rx="8" fill="#ffffff" opacity="0.95" />
              <path d="M30 78 L130 150 L230 78" stroke="#3b4ff0" strokeWidth="3" fill="none" />
            </svg>
          </div>
        </div>

        {/* Right Form Column */}
        <div className="form-panel">
          <div className="top-line">
            Don't have an account?
            <a href="#register" onClick={(e) => { e.preventDefault(); onNavigateToRegister(); }}>Sign Up.</a>
          </div>

          <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
            <div className={`field-auth field-email`}>
              <label htmlFor="emailInput">E-Mail</label>
              <div className={`input-wrap ${isFocusEmail ? 'focus' : ''}`} id="emailWrap">
                <input
                  type="text"
                  id="emailInput"
                  ref={emailInputRef}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setIsFocusEmail(true)}
                  onBlur={() => setIsFocusEmail(false)}
                  placeholder="admin@laporanwee.agency"
                />
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
              </div>
            </div>

            <div className={`field-auth field-pass`}>
              <label htmlFor="passInput">Password</label>
              <div className={`input-wrap ${isFocusPass ? 'focus' : ''}`} id="passWrap">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  id="passInput"
                  ref={passInputRef}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setIsFocusPass(true)}
                  onBlur={() => setIsFocusPass(false)}
                  placeholder="••••••••••••"
                />
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V8a4 4 0 018 0v3" />
                </svg>
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  aria-label={showLoginPassword ? 'Sembunyikan password' : 'Lihat password'}
                  title={showLoginPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showLoginPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Email Unverified Warning Box */}
            {isUnverified && (
              <div className="login-unverified-box">
                <div className="login-unverified-header">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>Email Belum Diverifikasi</span>
                </div>
                <p className="login-unverified-desc">
                  Silakan verifikasi email Anda terlebih dahulu sebelum masuk ke LaporanWee.
                </p>

                {resendSuccessMsg && (
                  <div className="login-unverified-success">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span>{resendSuccessMsg}</span>
                  </div>
                )}

                {resendErrorMsg && (
                  <div className="auth-error" style={{ marginBottom: 10 }}>
                    {resendErrorMsg}
                  </div>
                )}

                <button
                  type="button"
                  className="login-unverified-btn"
                  onClick={handleResendVerification}
                  disabled={isResending || resendCooldown > 0}
                  style={{ marginTop: resendSuccessMsg ? '10px' : '0' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                  <span>
                    {isResending
                      ? 'Mengirim ulang...'
                      : resendCooldown > 0
                      ? `Kirim ulang dalam ${resendCooldown} detik`
                      : 'Kirim Ulang Email Verifikasi'}
                  </span>
                </button>
              </div>
            )}

            {errorMsg && <div className="auth-error">{errorMsg}</div>}

            <button className={`btn-auth ${isLoading ? 'loading' : ''}`} id="signInBtn" type="submit">
              Sign In
              <span className="spinner-auth"></span>
            </button>
          </form>

          <p className="terms">
            By clicking the Sign In Button, you therefore agree to the Privacy Policy. For more information, read about our privacy here.
          </p>
        </div>

        {/* Success Overlay View */}
        <div className="success-panel">
          <h2>Success!</h2>
          <svg className="check" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12l5 5L20 6" />
          </svg>
          <p>
            Welcome to LaporanWee! Click proceed to enter your creative dashboard.
            <strong id="emailEcho">{email}</strong>
          </p>
          <button className="proceed" type="button" onClick={handleProceed}>
            Proceed
          </button>
        </div>
      </div>
    </div>
  );
};
