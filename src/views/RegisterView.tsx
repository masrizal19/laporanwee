import React, { useState } from 'react';
import '../auth.css';
import { API_BASE_URL } from '../utils/api';

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
  const [isSuccess, setIsSuccess] = useState(false);

  const [isFocusName, setIsFocusName] = useState(false);
  const [isFocusEmail, setIsFocusEmail] = useState(false);
  const [isFocusPass, setIsFocusPass] = useState(false);
  const [isFocusConfirm, setIsFocusConfirm] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

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

    if (!password) {
      setErrorMsg('Password tidak boleh kosong.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password minimal 6 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Password dan konfirmasi password tidak cocok.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    // 2. Safe debugging log (never log plain password)
    console.log('[Register] Mengirim data pendaftaran ke server:', {
      url: `${API_BASE_URL}/register.php`,
      payload: {
        name: trimmedName,
        email: trimmedEmail,
        password: '***',
      },
    });

    try {
      // 3. Absolute POST request to PHP MySQL backend
      const response = await fetch(`${API_BASE_URL}/register.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          password: password,
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

      if (!response.ok || data.success === false) {
        throw new Error(data.message || data.error || 'Registrasi gagal. Silakan coba lagi.');
      }

      // 5. On success: clear passwords, retain email, trigger success UI
      setIsLoading(false);
      setPassword('');
      setConfirmPassword('');
      try {
        localStorage.setItem('laporanwee_registered_email', trimmedEmail);
      } catch (_) {
        // Ignore storage exceptions if in private mode
      }
      setIsSuccess(true);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'Gagal mendaftarkan akun. Silakan coba lagi.');
    }
  };

  const handleProceed = () => {
    onRegisterSuccess();
  };

  return (
    <div className="auth-body">
      <div className={`stage ${isSuccess ? 'success' : ''}`} id="stage">
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

        {/* Success Overlay View */}
        <div className="success-panel">
          <h2>Akun Berhasil Dibuat!</h2>
          <svg className="check" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12l5 5L20 6" />
          </svg>
          <p>
            Akun Anda dengan email <strong>{email}</strong> telah berhasil didaftarkan.
            Silakan lanjut untuk masuk ke LaporanWee.
          </p>
          <button className="proceed" type="button" onClick={handleProceed}>
            Lanjut ke Login
          </button>
        </div>
      </div>
    </div>
  );
};
