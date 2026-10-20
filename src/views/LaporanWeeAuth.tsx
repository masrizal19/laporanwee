import React, { useState, useEffect } from 'react';
import { LwIcon } from '../components/LaporanWeeIcons';
import { API_CONFIG, UserProfileData } from '../utils/apiConfig';

interface LaporanWeeAuthProps {
  onLoginSuccess: (user: UserProfileData, token: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: (t: 'light' | 'dark') => void;
  onAddToast: (msg: string) => void;
}

type AuthScreen = 'login' | 'register' | 'verify' | 'success';

export const LaporanWeeAuth: React.FC<LaporanWeeAuthProps> = ({
  onLoginSuccess,
  theme,
  onToggleTheme,
  onAddToast,
}) => {
  const [screen, setScreen] = useState<AuthScreen>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('admin@gmail.com');
  const [loginPass, setLoginPass] = useState('rizal12345');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginEmailBad, setLoginEmailBad] = useState(false);
  const [loginPassBad, setLoginPassBad] = useState(false);
  const [loginErrorText, setLoginErrorText] = useState('Password minimal 6 karakter.');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  const [regNameBad, setRegNameBad] = useState(false);
  const [regEmailBad, setRegEmailBad] = useState(false);
  const [regPassBad, setRegPassBad] = useState(false);
  const [regConfirmBad, setRegConfirmBad] = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  // Verify screen state
  const [verifyEmail, setVerifyEmail] = useState('');
  const [resendCountdown, setResendCountdown] = useState(30);

  // Email validator
  const isMail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

  // Password strength meter
  const getPasswordStrength = (v: string) => {
    let n = 0;
    if (v.length >= 6) n++;
    if (v.length >= 9) n++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) n++;
    if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) n++;
    if (!v) n = 0;
    return n;
  };

  const strengthLabels = ['', 'Lemah', 'Cukup', 'Baik', 'Kuat'];
  const strengthColors = ['', '#e0615d', '#e8a24a', '#b7d94a', '#4a9d6b'];
  const currentStrength = getPasswordStrength(regPass);

  // Handle countdown for resend button
  useEffect(() => {
    if (screen !== 'verify') return;
    setResendCountdown(30);
    const interval = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [screen]);

  // Demo auto-fill
  const handleAutoFill = () => {
    setLoginEmail('admin@gmail.com');
    setLoginPass('rizal12345');
    setLoginEmailBad(false);
    setLoginPassBad(false);
    onAddToast('Akun demo berhasil diisi');
  };

  // Submit Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginLoading) return;

    const emailValid = isMail(loginEmail);
    const passValid = loginPass.length >= 6;

    setLoginEmailBad(!emailValid);
    setLoginPassBad(!passValid);
    setLoginErrorText('Password minimal 6 karakter.');

    if (!emailValid || !passValid) return;

    setLoginLoading(true);

    try {
      const res = await API_CONFIG.auth.login(loginEmail, loginPass);
      setTimeout(() => {
        setLoginLoading(false);
        onAddToast(`Berhasil masuk sebagai ${res.user.email}`);
        onLoginSuccess(res.user, res.token);
      }, 700);
    } catch (err: any) {
      setTimeout(() => {
        setLoginLoading(false);
        setLoginErrorText(err?.message || 'Email atau password salah.');
        setLoginEmailBad(true);
        setLoginPassBad(true);
      }, 600);
    }
  };

  // Submit Register
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regLoading) return;

    const nameValid = regName.trim().length > 1;
    const emailValid = isMail(regEmail);
    const passValid = regPass.length >= 6;
    const confirmValid = regConfirm === regPass && regConfirm.length >= 6;

    setRegNameBad(!nameValid);
    setRegEmailBad(!emailValid);
    setRegPassBad(!passValid);
    setRegConfirmBad(!confirmValid);

    if (!nameValid || !emailValid || !passValid || !confirmValid) return;

    setRegLoading(true);

    try {
      await API_CONFIG.auth.register(regName, regEmail, regPass);
      setTimeout(() => {
        setRegLoading(false);
        setVerifyEmail(regEmail.trim().toLowerCase());
        setScreen('verify');
        onAddToast('Link verifikasi dikirim ke email Anda');
      }, 800);
    } catch (err: any) {
      setRegLoading(false);
      onAddToast(err?.message || 'Gagal mendaftar');
    }
  };

  // Handle Verify link check
  const handleConfirmVerification = () => {
    API_CONFIG.auth.verifyEmail(verifyEmail);
    setScreen('success');
  };

  // Go to Dashboard from success screen
  const handleProceedToDashboard = () => {
    const user = API_CONFIG.getLocalUser();
    const token = API_CONFIG.getAuthToken() || `token_${Date.now()}`;
    onLoginSuccess(user, token);
  };

  // Active tab index for moving dark pill
  const activeTabIndex = screen === 'register' || screen === 'verify' ? 1 : 0;
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 940;

  return (
    <div className="lw-auth-wrapper">
      <div className="lw-ambient">
        <i />
        <i />
        <i />
      </div>

      {/* Top right theme switcher */}
      <div style={{ position: 'fixed', top: '20px', right: '22px', zIndex: 40 }}>
        <div className="lw-theme" role="group" aria-label="Tema">
          <div className="knob" />
          <button
            type="button"
            data-t="light"
            aria-label="Terang"
            onClick={() => onToggleTheme('light')}
          >
            <LwIcon name="sun" size={16} />
          </button>
          <button
            type="button"
            data-t="dark"
            aria-label="Gelap"
            onClick={() => onToggleTheme('dark')}
          >
            <LwIcon name="moon" size={16} />
          </button>
        </div>
      </div>

      <main className="lw-stage">
        {/* Left tabs rail */}
        <aside className="lw-side">
          <div className="lw-side-logo">
            <LwIcon name="logo" size={24} />
          </div>

          <div className="lw-tabs" role="tablist">
            <div
              className="lw-pill"
              style={{
                transform: isMobile
                  ? `translateX(${activeTabIndex * 102}px)`
                  : `translateY(${activeTabIndex * 72}px)`,
              }}
            />
            <button
              className={`lw-tab ${screen === 'login' ? 'on' : ''}`}
              role="tab"
              type="button"
              onClick={() => setScreen('login')}
            >
              <LwIcon name="doc" size={20} />
              Masuk
            </button>
            <button
              className={`lw-tab ${screen === 'register' ? 'on' : ''}`}
              role="tab"
              type="button"
              onClick={() => setScreen('register')}
            >
              <LwIcon name="users" size={20} />
              Daftar
            </button>
          </div>

          <div className="by">LaporanWee v3.0</div>
        </aside>

        {/* Creative Art Panel */}
        <section className="lw-art" aria-hidden="true">
          <span className="lw-badge">
            <i />
            LaporanWee v3.0
          </span>

          <div className="lw-copy">
            {screen === 'login' && (
              <div>
                <h2>Jangan lupa kerja hari ini</h2>
                <p>Catat progres kreatif tim dalam satu tempat setiap hari.</p>
              </div>
            )}
            {screen === 'register' && (
              <div>
                <h2>Bergabung dengan tim Anda</h2>
                <p>Buat akun dan mulai kirim laporan harian dalam hitungan menit.</p>
              </div>
            )}
            {screen === 'verify' && (
              <div>
                <h2>Satu langkah lagi</h2>
                <p>Kami sudah mengirim link verifikasi ke email Anda.</p>
              </div>
            )}
            {screen === 'success' && (
              <div>
                <h2>Akun Anda siap dipakai</h2>
                <p>Masuk ke dashboard dan mulai produktivitas tim sekarang.</p>
              </div>
            )}
          </div>

          <div className="lw-scene">
            <div className="lw-fc lw-fc1">
              <small>Rebranding Kopi Nusa</small>
              <b>Progres desain</b>
              <div className="lw-bar">
                <i style={{ width: '78%' }} />
              </div>
            </div>

            <div className="lw-fc lw-fc2">
              <small>Laporan hari ini</small>
              <b>Terkirim</b>
              <div className="lw-av-stack">
                <i style={{ background: '#e3ddfa' }}>Ri</i>
                <i style={{ background: '#e9f5b8' }}>Di</i>
                <i style={{ background: '#f6e6cf' }}>Sa</i>
                <i style={{ background: '#d6ecdf' }}>+5</i>
              </div>
            </div>

            <div className="lw-fc lw-fc3">
              <svg className="lw-mini-ring" viewBox="0 0 48 48">
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
        <section className="lw-formp">
          <div className="lw-switch">
            {screen === 'login' && (
              <>
                Belum punya akun?{' '}
                <a onClick={() => setScreen('register')} tabIndex={0}>
                  Daftar
                </a>
              </>
            )}
            {screen === 'register' && (
              <>
                Sudah punya akun?{' '}
                <a onClick={() => setScreen('login')} tabIndex={0}>
                  Masuk
                </a>
              </>
            )}
            {screen === 'verify' && (
              <>
                Salah email?{' '}
                <a onClick={() => setScreen('register')} tabIndex={0}>
                  Ubah
                </a>
              </>
            )}
          </div>

          <div className="lw-screens">
            {/* 1. Login Screen */}
            {screen === 'login' && (
              <form className="lw-scr" onSubmit={handleLoginSubmit} noValidate>
                <h1>Masuk</h1>
                <p className="lead">Selamat datang kembali. Lanjutkan pekerjaan Anda.</p>

                <div className={`lw-fld ${loginEmailBad ? 'bad' : ''}`}>
                  <label htmlFor="lw-login-email">E-Mail</label>
                  <div className="lw-inp">
                    <input
                      id="lw-login-email"
                      type="email"
                      placeholder="admin@gmail.com"
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        setLoginEmailBad(false);
                      }}
                      autoComplete="email"
                    />
                    <span className="ic">
                      <LwIcon name="mail" size={18} />
                    </span>
                  </div>
                  {loginEmailBad && <div className="lw-err">Masukkan alamat email yang valid.</div>}
                </div>

                <div className={`lw-fld ${loginPassBad ? 'bad' : ''}`}>
                  <label htmlFor="lw-login-pass">Password</label>
                  <div className="lw-inp">
                    <input
                      id="lw-login-pass"
                      type={showLoginPass ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={loginPass}
                      onChange={(e) => {
                        setLoginPass(e.target.value);
                        setLoginPassBad(false);
                      }}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="ic lw-eye"
                      aria-label="Tampilkan password"
                      onClick={() => setShowLoginPass(!showLoginPass)}
                    >
                      <LwIcon name={showLoginPass ? 'eyeOff' : 'eye'} size={18} />
                    </button>
                  </div>
                  {loginPassBad && <div className="lw-err">{loginErrorText}</div>}
                </div>

                <div className="lw-opts">
                  <label>
                    <input type="checkbox" defaultChecked />
                    <span className="lw-box">
                      <LwIcon name="check" size={12} strokeWidth={3} />
                    </span>
                    Ingat saya
                  </label>
                  <a
                    onClick={() => onAddToast('Hubungi administrator untuk mereset kata sandi Anda.')}
                  >
                    Lupa password?
                  </a>
                </div>

                <button className={`lw-btn ${loginLoading ? 'load' : ''}`} type="submit">
                  <span>Masuk</span>
                  <LwIcon name="arrowRight" size={17} strokeWidth={2} />
                  <i className="sp" />
                </button>

                <p className="lw-terms">Dengan masuk, Anda menyetujui Kebijakan Privasi LaporanWee.</p>

                <div className="lw-demo">
                  <div>
                    <b>Akun demo</b>
                    <span>admin@gmail.com · rizal12345</span>
                  </div>
                  <button type="button" onClick={handleAutoFill}>
                    Isi otomatis
                  </button>
                </div>
              </form>
            )}

            {/* 2. Register Screen */}
            {screen === 'register' && (
              <form className="lw-scr" onSubmit={handleRegisterSubmit} noValidate>
                <h1>Buat akun</h1>
                <p className="lead">Isi data di bawah untuk bergabung dengan tim.</p>

                <div className={`lw-fld ${regNameBad ? 'bad' : ''}`}>
                  <label htmlFor="lw-reg-name">Nama Lengkap</label>
                  <div className="lw-inp">
                    <input
                      id="lw-reg-name"
                      type="text"
                      placeholder="Masukkan nama lengkap Anda"
                      value={regName}
                      onChange={(e) => {
                        setRegName(e.target.value);
                        setRegNameBad(false);
                      }}
                      autoComplete="name"
                    />
                    <span className="ic">
                      <LwIcon name="profile" size={18} />
                    </span>
                  </div>
                  {regNameBad && <div className="lw-err">Nama lengkap wajib diisi.</div>}
                </div>

                <div className={`lw-fld ${regEmailBad ? 'bad' : ''}`}>
                  <label htmlFor="lw-reg-email">E-Mail</label>
                  <div className="lw-inp">
                    <input
                      id="lw-reg-email"
                      type="email"
                      placeholder="designer@wee.agency"
                      value={regEmail}
                      onChange={(e) => {
                        setRegEmail(e.target.value);
                        setRegEmailBad(false);
                      }}
                      autoComplete="email"
                    />
                    <span className="ic">
                      <LwIcon name="mail" size={18} />
                    </span>
                  </div>
                  {regEmailBad && <div className="lw-err">Masukkan alamat email yang valid.</div>}
                </div>

                <div className={`lw-fld ${regPassBad ? 'bad' : ''}`}>
                  <label htmlFor="lw-reg-pass">Password</label>
                  <div className="lw-inp">
                    <input
                      id="lw-reg-pass"
                      type={showRegPass ? 'text' : 'password'}
                      placeholder="Minimal 6 karakter"
                      value={regPass}
                      onChange={(e) => {
                        setRegPass(e.target.value);
                        setRegPassBad(false);
                      }}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="ic lw-eye"
                      aria-label="Tampilkan password"
                      onClick={() => setShowRegPass(!showRegPass)}
                    >
                      <LwIcon name={showRegPass ? 'eyeOff' : 'eye'} size={18} />
                    </button>
                  </div>

                  <div className="lw-meter">
                    <i style={{ background: currentStrength >= 1 ? strengthColors[currentStrength] : '' }} />
                    <i style={{ background: currentStrength >= 2 ? strengthColors[currentStrength] : '' }} />
                    <i style={{ background: currentStrength >= 3 ? strengthColors[currentStrength] : '' }} />
                    <i style={{ background: currentStrength >= 4 ? strengthColors[currentStrength] : '' }} />
                  </div>
                  <div className="lw-meter-t">
                    {currentStrength ? `Kekuatan password: ${strengthLabels[currentStrength]}` : ''}
                  </div>
                  {regPassBad && <div className="lw-err">Password minimal 6 karakter.</div>}
                </div>

                <div className={`lw-fld ${regConfirmBad ? 'bad' : ''}`}>
                  <label htmlFor="lw-reg-confirm">Konfirmasi Password</label>
                  <div className="lw-inp">
                    <input
                      id="lw-reg-confirm"
                      type={showRegConfirm ? 'text' : 'password'}
                      placeholder="Ulangi password Anda"
                      value={regConfirm}
                      onChange={(e) => {
                        setRegConfirm(e.target.value);
                        setRegConfirmBad(false);
                      }}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="ic lw-eye"
                      aria-label="Tampilkan password"
                      onClick={() => setShowRegConfirm(!showRegConfirm)}
                    >
                      <LwIcon name={showRegConfirm ? 'eyeOff' : 'eye'} size={18} />
                    </button>
                  </div>
                  {regConfirmBad && <div className="lw-err">Konfirmasi password tidak sama.</div>}
                </div>

                <button className={`lw-btn ${regLoading ? 'load' : ''}`} type="submit">
                  <span>Daftar</span>
                  <LwIcon name="arrowRight" size={17} strokeWidth={2} />
                  <i className="sp" />
                </button>
              </form>
            )}

            {/* 3. Verify Screen */}
            {screen === 'verify' && (
              <div className="lw-scr">
                <div className="lw-env">
                  <div className="ring" />
                  <LwIcon name="mail" size={52} strokeWidth={1.6} />
                </div>
                <h1>Periksa email Anda</h1>
                <p className="lead" style={{ marginBottom: '6px' }}>
                  Kirim ulang link verifikasi ke:
                </p>
                <div>
                  <span className="lw-mailto">{verifyEmail || 'user@laporanwee.agency'}</span>
                </div>
                <button
                  className="lw-btn"
                  type="button"
                  onClick={handleConfirmVerification}
                  style={{ marginTop: '16px' }}
                >
                  <span>Saya sudah verifikasi</span>
                  <LwIcon name="arrowRight" size={17} strokeWidth={2} />
                </button>
                <div className="lw-resend">
                  {resendCountdown > 0 ? (
                    <span>Kirim ulang dalam {resendCountdown} detik</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        API_CONFIG.auth.resendVerification(verifyEmail);
                        onAddToast('Link verifikasi dikirim ulang');
                        setResendCountdown(30);
                      }}
                    >
                      Kirim ulang link
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 4. Success Screen */}
            {screen === 'success' && (
              <div className="lw-scr">
                <svg className="lw-okc" viewBox="0 0 104 104">
                  <circle cx="52" cy="52" r="48" />
                  <path d="m32 54 14 14 27-30" />
                </svg>
                <h1>Email berhasil diverifikasi</h1>
                <p className="lead">Akun Anda aktif. Anda bisa langsung masuk ke dashboard.</p>
                <button
                  className="lw-btn"
                  type="button"
                  onClick={handleProceedToDashboard}
                  style={{ marginTop: '16px' }}
                >
                  <span>Masuk ke Dashboard</span>
                  <LwIcon name="arrowRight" size={17} strokeWidth={2} />
                </button>
              </div>
            )}
          </div>

          <p className="lw-foot">LaporanWee v3.0 • Jangan lupa kerja hari ini</p>
        </section>
      </main>
    </div>
  );
};
