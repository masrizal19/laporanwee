import React, { useState, useEffect } from 'react';
import '../auth.css';
import { buildApiUrl } from '../utils/api';
import { resendVerificationEmail } from '../utils/authService';

interface RegisterViewProps {
  onRegisterSuccess: () => void;
  onNavigateToLogin: () => void;
  logoUrl?: string | null;
}

export const RegisterView: React.FC<RegisterViewProps> = ({
  onRegisterSuccess,
  onNavigateToLogin,
  logoUrl,
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

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 9) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/\d/.test(pass) && /[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const passScore = getPasswordStrength(password);
  const passLabels = ['', 'Lemah', 'Cukup', 'Baik', 'Kuat'];
  const passColors = ['', '#e0615d', '#e8a24a', '#b7d94a', '#4a9d6b'];

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
      setErrorMsg('Konfirmasi password tidak sama.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const registerUrl = buildApiUrl('/register.php');
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
          password: password,
          password_confirmation: confirmPassword,
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

      if (!response.ok || data.success === false) {
        if (
          code === 'PASSWORD_MISMATCH' ||
          lowerMsg.includes('password_confirmation') ||
          lowerMsg.includes('konfirmasi password')
        ) {
          throw new Error('Konfirmasi password tidak sama dengan password.');
        }

        if (code === 'EMAIL_EXISTS' || lowerMsg.includes('sudah terdaftar')) {
          throw new Error('Alamat email sudah terdaftar. Silakan masuk ke akun Anda.');
        }

        if (code === 'EMAIL_NOT_VERIFIED') {
          setRegisteredEmail(trimmedEmail);
          setIsVerificationPending(true);
          setIsLoading(false);
          return;
        }

        throw new Error(rawMsg || 'Registrasi gagal. Silakan periksa kembali data Anda.');
      }

      setIsLoading(false);
      setPassword('');
      setConfirmPassword('');
      try {
        localStorage.setItem('laporanwee_registered_email', trimmedEmail);
      } catch (_) {}
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
            <div className="pill" style={{ transform: 'translateY(70px)' }} />
            <button
              className="tab"
              role="tab"
              type="button"
              onClick={onNavigateToLogin}
              aria-selected="false"
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              Masuk
            </button>
            <button className="tab on" role="tab" type="button" aria-selected="true">
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
            <h2>Bergabung dengan tim Anda</h2>
            <p>Buat akun dan mulai kirim laporan harian terstruktur dalam hitungan menit.</p>
          </div>
          <div className="scene">
            <div className="fc fc1">
              <small>Kampanye Ramadan</small>
              <b>Konten 30 hari</b>
              <div className="bar-fill">
                <i style={{ width: '62%' }} />
              </div>
            </div>
            <div className="fc fc2">
              <small>Tim Kreatif</small>
              <b>8 Anggota Aktif</b>
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
                <b style={{ margin: 0 }}>88%</b>
              </div>
            </div>
          </div>
        </section>

        {/* Form Panel */}
        <section className="formp">
          <div className="switch-top">
            Sudah punya akun?
            <a onClick={onNavigateToLogin}>Masuk</a>
          </div>

          <div className="screens">
            {isVerificationPending ? (
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
                  Pendaftaran berhasil! Kami telah mengirimkan link verifikasi akun ke:
                </p>
                <div>
                  <span className="mailto-box">{registeredEmail || email}</span>
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
                  onClick={onNavigateToLogin}
                >
                  <span>Masuk ke Akun Anda</span>
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>

                <div className="resend-box">
                  Belum menerima email?{' '}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || isResending}
                  >
                    {isResending
                      ? 'Mengirim ulang...'
                      : resendCooldown > 0
                      ? `Kirim ulang dalam ${resendCooldown}s`
                      : 'Kirim Ulang Link'}
                  </button>
                </div>
              </div>
            ) : (
              <form className="scr" onSubmit={handleSignUp} noValidate>
                <h1>Buat akun</h1>
                <p className="lead">Isi data di bawah untuk bergabung dengan tim kreatif.</p>

                <div className={`fld ${errorMsg && !name ? 'bad' : ''}`}>
                  <label htmlFor="reg-name">Nama Lengkap</label>
                  <div className="inp">
                    <input
                      id="reg-name"
                      type="text"
                      placeholder="Masukkan nama lengkap Anda"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setErrorMsg('');
                      }}
                    />
                    <span className="ic">
                      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 21a8 8 0 0 1 16 0" />
                      </svg>
                    </span>
                  </div>
                </div>

                <div className={`fld ${errorMsg && !email ? 'bad' : ''}`}>
                  <label htmlFor="reg-email">E-Mail</label>
                  <div className="inp">
                    <input
                      id="reg-email"
                      type="email"
                      placeholder="designer@wee.agency"
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

                <div className="fld">
                  <label htmlFor="reg-pass">Password</label>
                  <div className="inp">
                    <input
                      id="reg-pass"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Minimal 6 karakter"
                      autoComplete="new-password"
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
                  {/* Live Password Strength Meter */}
                  <div className="meter">
                    {[1, 2, 3, 4].map((step) => (
                      <i
                        key={step}
                        style={{
                          background:
                            passScore >= step ? passColors[passScore] : '',
                        }}
                      />
                    ))}
                  </div>
                  {passScore > 0 && (
                    <div className="meter-t" style={{ color: passColors[passScore] }}>
                      Kekuatan password: {passLabels[passScore]}
                    </div>
                  )}
                </div>

                <div className={`fld ${errorMsg ? 'bad' : ''}`}>
                  <label htmlFor="reg-confirm">Konfirmasi Password</label>
                  <div className="inp">
                    <input
                      id="reg-confirm"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Ulangi password Anda"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setErrorMsg('');
                      }}
                    />
                    <button
                      type="button"
                      className="ic eye"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    >
                      {showConfirmPassword ? (
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

                <button
                  className={`btn-auth-main ${isLoading ? 'load' : ''}`}
                  type="submit"
                >
                  <span>Daftar Sekarang</span>
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                  <i className="sp" />
                </button>
              </form>
            )}
          </div>

          <p className="foot-auth">LaporanWee v5.0 • Jangan lupa kerja hari ini</p>
        </section>
      </main>
    </div>
  );
};
