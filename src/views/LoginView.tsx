import React, { useState, useEffect, useRef } from 'react';
import '../auth.css';

interface LoginViewProps {
  onLoginSuccess: (email: string, name: string) => void;
  onNavigateToRegister: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  onNavigateToRegister,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isFocusEmail, setIsFocusEmail] = useState(false);
  const [isFocusPass, setIsFocusPass] = useState(false);

  const [emailCaret, setEmailCaret] = useState(true);
  const [passCaret, setPassCaret] = useState(true);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passInputRef = useRef<HTMLInputElement>(null);

  // Trigger auto-typing simulation similar to the master design
  const runTypingSimulation = () => {
    setEmail('');
    setPassword('');
    setErrorMsg('');
    setIsSuccess(false);
    setIsLoading(false);

    const DEMO_EMAIL = 'admin@laporanwee.agency';
    const DEMO_PASS = 'admin123';

    // 1. Focus email field
    setTimeout(() => {
      setIsFocusEmail(true);
      setEmailCaret(false);
      let emailIdx = 0;
      let currentEmail = '';
      const emailInterval = setInterval(() => {
        currentEmail += DEMO_EMAIL[emailIdx];
        setEmail(currentEmail);
        emailIdx++;
        if (emailIdx >= DEMO_EMAIL.length) {
          clearInterval(emailInterval);
          setEmailCaret(true);
          setIsFocusEmail(false);

          // 2. Focus password field after 350ms
          setTimeout(() => {
            setIsFocusPass(true);
            setPassCaret(false);
            let passIdx = 0;
            let currentPass = '';
            const passInterval = setInterval(() => {
              currentPass += DEMO_PASS[passIdx];
              setPassword(currentPass);
              passIdx++;
              if (passIdx >= DEMO_PASS.length) {
                clearInterval(passInterval);
                setPassCaret(true);
                setIsFocusPass(false);

                // 3. Trigger button loading after 500ms
                setTimeout(() => {
                  setIsLoading(true);
                  // 4. Show success screen after 900ms
                  setTimeout(() => {
                    setIsLoading(false);
                    setIsSuccess(true);
                  }, 900);
                }, 500);
              }
            }, 70);
          }, 350);
        }
      }, 55);
    }, 500);
  };

  // Run the typing simulation on mount automatically so they get the awesome video-like onboarding!
  useEffect(() => {
    runTypingSimulation();
  }, []);

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Harap isi E-Mail dan Password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    // Verification against registered accounts in localStorage
    setTimeout(() => {
      const storedUsersRaw = localStorage.getItem('laporanwee_registered_users');
      const users = storedUsersRaw ? JSON.parse(storedUsersRaw) : [];

      // Include default admin credentials
      const defaultUsers = [
        { email: 'admin@laporanwee.agency', password: 'admin123', name: 'Rangga Arya' },
        { email: 'youremail@gmail.com', password: 'password123', name: 'Rangga Arya' }
      ];

      const allUsers = [...defaultUsers, ...users];
      const match = allUsers.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );

      setIsLoading(false);

      if (match) {
        setIsSuccess(true);
      } else {
        setErrorMsg('Email atau password tidak sesuai.');
      }
    }, 1000);
  };

  const handleProceed = () => {
    // Find matching user or fallback to default name
    const storedUsersRaw = localStorage.getItem('laporanwee_registered_users');
    const users = storedUsersRaw ? JSON.parse(storedUsersRaw) : [];
    const matched = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
    const finalName = matched ? matched.name : 'Rangga Arya';

    onLoginSuccess(email || 'admin@laporanwee.agency', finalName);
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
                <span className={`caret ${emailCaret ? 'hidden' : ''}`} id="emailCaret"></span>
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
                <span className={`caret ${passCaret ? 'hidden' : ''}`} id="passCaret"></span>
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
            <strong id="emailEcho">{email || 'admin@laporanwee.agency'}</strong>
          </p>
          <button className="proceed" type="button" onClick={handleProceed}>
            Proceed
          </button>
        </div>
      </div>

      {/* Demo helper options */}
      <div className="demo-control-bar">
        <button className="demo-btn" type="button" onClick={runTypingSimulation}>
          Run Auto-Type Simulation
        </button>
      </div>
    </div>
  );
};
