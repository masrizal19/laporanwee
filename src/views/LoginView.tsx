import React, { useState, useEffect, useRef } from 'react';
import '../auth.css';
import { API_BASE_URL } from '../utils/api';

interface LoginViewProps {
  onLoginSuccess: (email: string, name: string) => void;
  onNavigateToRegister: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  onNavigateToRegister,
}) => {
  const [email, setEmail] = useState(() => {
    return localStorage.getItem('laporanwee_registered_email') || '';
  });
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isFocusEmail, setIsFocusEmail] = useState(false);
  const [isFocusPass, setIsFocusPass] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passInputRef = useRef<HTMLInputElement>(null);

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

    // Safe debugging log (never log plain password)
    console.log('[Login] Mengirim permintaan login ke server:', {
      url: `${API_BASE_URL}/login.php`,
      payload: {
        email: trimmedEmail,
        password: '***',
      },
    });

    try {
      // Direct POST request to PHP MySQL backend
      const response = await fetch(`${API_BASE_URL}/login.php`, {
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

      if (!response.ok || data.success === false) {
        throw new Error(data.message || data.error || 'Email atau password tidak sesuai.');
      }

      setIsLoading(false);

      const token = data.token || data.data?.token || 'session-active-token';
      localStorage.setItem('laporanwee_token', token);

      const emailVal = data.user?.email || data.data?.user?.email || trimmedEmail;
      const nameVal = data.user?.full_name || data.user?.name || data.data?.user?.full_name || data.data?.user?.name || trimmedEmail.split('@')[0];

      const userObj = {
        email: emailVal,
        name: nameVal,
      };
      localStorage.setItem('laporanwee_user', JSON.stringify(userObj));
      setIsSuccess(true);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'Email atau password tidak sesuai.');
    }
  };

  const handleProceed = () => {
    const storedUser = localStorage.getItem('laporanwee_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        onLoginSuccess(parsed.email, parsed.name);
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
          <div className="logo-auth"></div>
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
                  type="password"
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
              </div>
            </div>

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
