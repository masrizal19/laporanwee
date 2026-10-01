import React, { useState, useEffect } from 'react';
import '../auth.css';
import { API_BASE_URL, buildApiUrl } from '../utils/api';
import { maskEmail, openWebmail, resendVerificationEmail } from '../utils/authService';

interface RegisterViewProps {
  onRegisterSuccess: () => void;
  onNavigateToLogin: () => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({
  onRegisterSuccess,
  onNavigateToLogin,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Verification Pending UI States
  const [isVerificationPending, setIsVerificationPending] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccessMsg, setResendSuccessMsg] = useState('');
  const [resendErrorMsg, setResendErrorMsg] = useState('');

  const [isFocusName, setIsFocusName] = useState(false);
  const [isFocusEmail, setIsFocusEmail] = useState(false);
  const [isFocusPass, setIsFocusPass] = useState(false);
  const [isFocusConfirm, setIsFocusConfirm] = useState(false);

  // Countdown timer for resend verification
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    const rawPassword = password;
    const rawConfirmPassword = confirmPassword;

    // 1. Strict frontend validations
    if (!trimmedName) {
      setErrorMsg('Nama lengkap tidak boleh kosong.');
      return;
    }

    if (!trimmedEmail) {
      setErrorMsg('Alamat email tidak boleh kosong.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMsg('Format email tidak valid. Harap periksa kembali.');
      return;
    }

    if (!rawPassword) {
      setErrorMsg('Password tidak boleh kosong.');
      return;
    }

    if (rawPassword.length < 6) {
      setErrorMsg('Password minimal 6 karakter.');
      return;
    }

    if (rawPassword !== rawConfirmPassword) {
      setErrorMsg('Konfirmasi password tidak sama.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    // 2. Safe debugging log (never log plain password)
    console.log('[Register] Mengirim data pendaftaran ke server:', {
      url: `${API_BASE_URL}/register.php`,
      payload: {
        full_name: trimmedName,
        email: trimmedEmail,
        password: '***',
        password_confirmation: '***',
      },
    });

    try {
      // 3. Absolute POST request to PHP MySQL backend using VITE_API_URL base
      const registerUrl = buildApiUrl('/register.php');
      console.log('[Register] URL Request:', registerUrl);
      console.log('[API REQUEST]', { method: 'POST', url: registerUrl });
      const response = await fetch(registerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          full_name: trimmedName,
          name: trimmedName,
          email: trimmedEmail,
          password: rawPassword,
          password_confirmation: rawConfirmPassword,
        }),
      });

      // 4. Safe text-then-parse response pattern
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

      if (!response.ok || data.success === false) {
        if (
          code === 'PASSWORD_MISMATCH' ||
          lowerMsg.includes('password_confirmation') ||
          lowerMsg.includes('konfirmasi password') ||
          lowerMsg.includes('password confirmation') ||
          lowerMsg.includes('tidak sama') ||
          lowerMsg.includes('mismatch')
        ) {
          throw new Error('Konfirmasi password tidak sama dengan password.');
        }

        if (
          code === 'EMAIL_EXISTS' ||
          lowerMsg.includes('email sudah terdaftar') ||
          lowerMsg.includes('email exists') ||
          lowerMsg.includes('already exists')
        ) {
          throw new Error('Alamat email sudah terdaftar. Silakan gunakan email lain atau masuk ke akun Anda.');
        }

        if (code === 'EMAIL_NOT_VERIFIED') {
          setRegisteredEmail(trimmedEmail);
          setIsVerificationPending(true);
          setIsLoading(false);
          return;
        }

        throw new Error(rawMsg || 'Registrasi gagal. Silakan periksa kembali data Anda.');
      }

      // 5. On success: clear sensitive fields, retain registered email, and show "Pendaftaran Berhasil" step
      setIsLoading(false);
      setPassword('');
      setConfirmPassword('');
      try {
        localStorage.setItem('laporanwee_registered_email', trimmedEmail);
      } catch (_) {
        // Ignore storage exceptions if in private mode
      }
      setRegisteredEmail(trimmedEmail);
      setIsVerificationPending(true);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'Gagal mendaftarkan akun. Silakan coba lagi.');
    }
  };

  const handleResend = async () => {
    if (!registeredEmail || resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setResendSuccessMsg('');
    setResendErrorMsg('');

    try {
      const res = await resendVerificationEmail(registeredEmail);
      setResendSuccessMsg(res.message || 'Email verifikasi berhasil dikirim ulang.');
      setResendCooldown(60);
    } catch (err: any) {
      setResendErrorMsg(err?.message || 'Gagal mengirim ulang email verifikasi.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="auth-body">
      <div className={`stage ${isVerificationPending ? 'verification-pending' : ''}`} id="stage">
        {/* Left Sidebar */}
        <div className="sidebar">
          <div className="logo-auth"></div>
          <div className="side-nav">
            <button
              className="nav-item-auth"
              type="button"
              onClick={onNavigateToLogin}
              aria-label="Sign In"
            >
              <span className="icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="#8b8fb3" strokeWidth="1.8">
                  <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </span>
              <span>Sign In</span>
            </button>
            <button className="nav-item-auth active" type="button" aria-label="Sign Up">
              <span className="icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="#4a5cf5" strokeWidth="1.8">
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
          <p>Daftarkan akun kreatif Anda di LaporanWee.</p>
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
            Already have an account?
            <a href="#login" onClick={(e) => { e.preventDefault(); onNavigateToLogin(); }}>Sign In.</a>
          </div>

          <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
            <div className={`field-auth field-name`}>
              <label htmlFor="nameInput">Nama Lengkap</label>
              <div className={`input-wrap ${isFocusName ? 'focus' : ''}`}>
                <input
                  type="text"
                  id="nameInput"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setIsFocusName(true)}
                  onBlur={() => setIsFocusName(false)}
                  placeholder="Masukkan nama lengkap Anda"
                  required
                />
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            </div>

            <div className={`field-auth field-email`}>
              <label htmlFor="emailInput">E-Mail</label>
              <div className={`input-wrap ${isFocusEmail ? 'focus' : ''}`}>
                <input
                  type="email"
                  id="emailInput"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setIsFocusEmail(true)}
                  onBlur={() => setIsFocusEmail(false)}
                  placeholder="designer@wee.agency"
                  required
                />
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
              </div>
            </div>

            <div className={`field-auth field-pass`}>
              <label htmlFor="passInput">Password</label>
              <div className={`input-wrap ${isFocusPass ? 'focus' : ''}`}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="passInput"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setIsFocusPass(true)}
                  onBlur={() => setIsFocusPass(false)}
                  placeholder="Minimal 6 karakter"
                  required
                />
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V8a4 4 0 018 0v3" />
                </svg>
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? (
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

            <div className={`field-auth field-pass`}>
              <label htmlFor="confirmPassInput">Konfirmasi Password</label>
              <div className={`input-wrap ${isFocusConfirm ? 'focus' : ''}`}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassInput"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={() => setIsFocusConfirm(true)}
                  onBlur={() => setIsFocusConfirm(false)}
                  placeholder="Ulangi password Anda"
                  required
                />
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V8a4 4 0 018 0v3" />
                </svg>
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi password' : 'Lihat konfirmasi password'}
                  title={showConfirmPassword ? 'Sembunyikan konfirmasi password' : 'Lihat konfirmasi password'}
                >
                  {showConfirmPassword ? (
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

            {errorMsg && <div className="auth-error">{errorMsg}</div>}

            <button className={`btn-auth ${isLoading ? 'loading' : ''}`} id="signUpBtn" type="submit">
              Sign Up
              <span className="spinner-auth"></span>
            </button>
          </form>

          <p className="terms">
            By clicking the Sign Up Button, you therefore agree to the Privacy Policy. For more information, read about our privacy here.
          </p>
        </div>

        {/* Dedicated "Verifikasi Email Anda" Panel on Successful Registration */}
        <div className="register-verify-panel">
          <div className="mail-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <path d="M22 6l-10 7L2 6" />
            </svg>
          </div>

          <h2>Pendaftaran Berhasil</h2>
          <p style={{ fontWeight: 700, color: 'var(--ink-900)', margin: '0 0 4px', fontSize: '15px' }}>
            Verifikasi Email Anda
          </p>
          <p>
            Akun Anda berhasil didaftarkan dan berstatus nonaktif sementara. Kami telah mengirimkan link aktivasi ke email Anda. Silakan verifikasi email Anda terlebih dahulu sebelum masuk ke LaporanWee.
          </p>

          <div className="verify-email-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 14, height: 14 }}>
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
            <span>{maskEmail(registeredEmail || email)}</span>
          </div>

          {resendSuccessMsg && (
            <div className="verify-alert success" style={{ maxWidth: 360, width: '100%' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span>{resendSuccessMsg}</span>
            </div>
          )}

          {resendErrorMsg && (
            <div className="verify-alert error" style={{ maxWidth: 360, width: '100%' }}>
              <span>{resendErrorMsg}</span>
            </div>
          )}

          <div className="verify-action-stack" style={{ width: '100%', maxWidth: 360 }}>
            {/* Tombol Utama: Buka Email */}
            <button
              type="button"
              className="btn-verify-primary"
              onClick={() => openWebmail(registeredEmail || email)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>Buka Email</span>
            </button>

            {/* Tombol Sekunder: Kirim Ulang Email */}
            <button
              type="button"
              className="btn-verify-secondary"
              onClick={handleResend}
              disabled={isResending || resendCooldown > 0}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              <span>
                {isResending
                  ? 'Mengirim ulang...'
                  : resendCooldown > 0
                  ? `Kirim ulang dalam ${resendCooldown} detik`
                  : 'Kirim Ulang Email'}
              </span>
            </button>

            {/* Tombol: Kembali ke Login */}
            <button
              type="button"
              className="btn-verify-ghost"
              onClick={onNavigateToLogin}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Kembali ke Login</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

