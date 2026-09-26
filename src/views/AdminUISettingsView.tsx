import React, { useState, useEffect } from 'react';
import { UISettings, ViewType } from '../types';
import { Icon } from '../components/icons';
import {
  DEFAULT_UI_SETTINGS,
  ADMIN_EMAIL,
  fetchUISettings,
  saveUISettings,
  applyUISettingsToDocument,
} from '../utils/uiSettings';

interface AdminUISettingsViewProps {
  onNavigate: (view: ViewType) => void;
  onAddToast: (text: string) => void;
  userEmail?: string;
  userName?: string;
}

const FONT_PRESETS = [
  'Poppins',
  'Plus Jakarta Sans',
  'Inter',
  'Roboto',
  'Outfit',
  'Montserrat',
  'Open Sans',
  'Nunito',
];

export const AdminUISettingsView: React.FC<AdminUISettingsViewProps> = ({
  onNavigate,
  onAddToast,
  userEmail,
  userName,
}) => {
  const isAdmin = userEmail?.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Settings state
  const [settings, setSettings] = useState<UISettings>(DEFAULT_UI_SETTINGS);
  const [initialLoadedSettings, setInitialLoadedSettings] = useState<UISettings>(DEFAULT_UI_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Reset confirmation modal
  const [showResetModal, setShowResetModal] = useState<boolean>(false);

  // Local file previews for branding uploads
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);

  const [menuIconPreview, setMenuIconPreview] = useState<string | null>(null);
  const [menuIconFileName, setMenuIconFileName] = useState<string | null>(null);

  const [signoutIconPreview, setSignoutIconPreview] = useState<string | null>(null);
  const [signoutIconFileName, setSignoutIconFileName] = useState<string | null>(null);

  // Fetch UI settings from API on mount
  const loadSettings = async () => {
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await fetchUISettings();
      setSettings(data);
      setInitialLoadedSettings(data);
      applyUISettingsToDocument(data);
    } catch (err: any) {
      setFetchError('Gagal mengambil pengaturan UI.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [isAdmin]);

  // Update real-time live preview whenever user modifies settings
  const handleFieldChange = <K extends keyof UISettings>(field: K, value: UISettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [field]: value };
      applyUISettingsToDocument(next);
      return next;
    });
    setSaveError(null);
    setSaveSuccessMsg(null);
  };

  // File upload handlers (Local File Preview)
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setPreview: (url: string | null) => void,
    setFileName: (name: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        onAddToast('Ukuran file maksimal 5MB.');
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      setFileName(file.name);
    }
  };

  // Submit POST to API
  const handleSave = async (settingsToSave = settings) => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccessMsg(null);

    try {
      await saveUISettings(settingsToSave);
      setInitialLoadedSettings(settingsToSave);
      applyUISettingsToDocument(settingsToSave);
      setSaveSuccessMsg('✓ UI berhasil diperbarui');
      onAddToast('✓ UI berhasil diperbarui');
    } catch (err: any) {
      setSaveError(err.message || 'Gagal menyimpan pengaturan UI.');
      onAddToast(err.message || 'Gagal menyimpan pengaturan UI.');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default flow
  const handleResetConfirm = async () => {
    setShowResetModal(false);
    setSettings(DEFAULT_UI_SETTINGS);
    setLogoPreview(null);
    setLogoFileName(null);
    setMenuIconPreview(null);
    setMenuIconFileName(null);
    setSignoutIconPreview(null);
    setSignoutIconFileName(null);
    applyUISettingsToDocument(DEFAULT_UI_SETTINGS);
    await handleSave(DEFAULT_UI_SETTINGS);
  };

  // If user is not admin, deny access immediately
  if (!isAdmin) {
    return (
      <div className="view">
        <div className="admin-access-denied-card">
          <div className="shield-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2>Akses Admin Ditolak</h2>
          <p>
            Halaman <strong>UI Settings</strong> hanya dapat diakses oleh administrator resmi (
            <span className="admin-highlight">{ADMIN_EMAIL}</span>).
          </p>
          <div className="current-user-info">
            Akun Anda saat ini: <strong>{userEmail || 'Tamu / Tidak terautentikasi'}</strong>
          </div>
          <button className="btn btn-dark" onClick={() => onNavigate('dashboard')}>
            <Icon name="home" />
            <span>Kembali ke Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div className="view">
        <div className="page-head">
          <div>
            <h1>UI Settings</h1>
            <p className="sub">Memuat pengaturan UI dari server...</p>
          </div>
        </div>
        <div className="loading-skeleton-panel">
          <div className="skeleton-line title" />
          <div className="skeleton-grid">
            <div className="skeleton-box" />
            <div className="skeleton-box" />
          </div>
          <p className="loading-text">Menghubungkan ke API UI Settings...</p>
        </div>
      </div>
    );
  }

  // Fetch Error State
  if (fetchError && !settings) {
    return (
      <div className="view">
        <div className="page-head">
          <div>
            <h1>UI Settings</h1>
            <p className="sub">Kelola tampilan aplikasi LaporanWee</p>
          </div>
        </div>
        <div className="admin-error-card">
          <Icon name="x" className="error-icon" />
          <h3>Gagal mengambil pengaturan UI</h3>
          <p>{fetchError}</p>
          <button className="btn btn-dark" onClick={loadSettings}>
            <Icon name="refresh" />
            <span>Coba Lagi</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="view admin-ui-settings-view">
      {/* Page Header */}
      <div className="page-head">
        <div>
          <div className="admin-badge-pill">
            <span className="dot" />
            <span>Admin Control Panel &bull; {ADMIN_EMAIL}</span>
          </div>
          <h1 style={{ fontFamily: settings.heading_font || 'inherit' }}>UI Settings</h1>
          <p className="sub">
            Kelola tampilan, palet warna, tipografi, dan ukuran icon aplikasi LaporanWee
          </p>
        </div>
        <div className="admin-header-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setShowResetModal(true)}
            disabled={isSaving}
          >
            <Icon name="refresh" />
            <span>Reset Default</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ backgroundColor: settings.primary_color }}
            onClick={() => handleSave()}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <span className="spinner-auth" style={{ width: 16, height: 16, borderTopColor: '#fff' }} />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Icon name="check" />
                <span>Simpan Perubahan</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {saveSuccessMsg && (
        <div className="admin-alert success">
          <Icon name="check" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}
      {saveError && (
        <div className="admin-alert danger">
          <Icon name="x" />
          <span>{saveError}</span>
        </div>
      )}

      {/* 2-Column Grid Layout: Form on Left, Live Preview on Right */}
      <div className="admin-settings-grid">
        {/* LEFT COLUMN: Settings Form */}
        <div className="admin-settings-form-column">
          {/* Section 1: Appearance (Colors) */}
          <div className="admin-card">
            <div className="card-header">
              <div className="card-icon" style={{ backgroundColor: `${settings.primary_color}18`, color: settings.primary_color }}>
                <Icon name="palette" />
              </div>
              <div>
                <h2>Appearance</h2>
                <p>Sesuaikan palet warna utama yang digunakan di seluruh aplikasi</p>
              </div>
            </div>

            <div className="color-inputs-grid">
              {/* Primary Color */}
              <div className="color-field">
                <label htmlFor="primaryColor">Primary Color</label>
                <div className="color-input-wrapper">
                  <input
                    type="color"
                    id="primaryColorPicker"
                    value={settings.primary_color}
                    onChange={(e) => handleFieldChange('primary_color', e.target.value)}
                    aria-label="Pilih Warna Utama"
                  />
                  <input
                    type="text"
                    id="primaryColor"
                    value={settings.primary_color}
                    onChange={(e) => handleFieldChange('primary_color', e.target.value)}
                    placeholder="#4A55FF"
                  />
                </div>
                <span className="field-hint">Aksen tombol, badge aktif, dan highlight</span>
              </div>

              {/* Secondary Color */}
              <div className="color-field">
                <label htmlFor="secondaryColor">Secondary Color</label>
                <div className="color-input-wrapper">
                  <input
                    type="color"
                    id="secondaryColorPicker"
                    value={settings.secondary_color}
                    onChange={(e) => handleFieldChange('secondary_color', e.target.value)}
                    aria-label="Pilih Warna Sekunder"
                  />
                  <input
                    type="text"
                    id="secondaryColor"
                    value={settings.secondary_color}
                    onChange={(e) => handleFieldChange('secondary_color', e.target.value)}
                    placeholder="#19194D"
                  />
                </div>
                <span className="field-hint">Header, navigasi samping, dan badge kontras</span>
              </div>

              {/* Text Color */}
              <div className="color-field">
                <label htmlFor="textColor">Text Color</label>
                <div className="color-input-wrapper">
                  <input
                    type="color"
                    id="textColorPicker"
                    value={settings.text_color}
                    onChange={(e) => handleFieldChange('text_color', e.target.value)}
                    aria-label="Pilih Warna Teks"
                  />
                  <input
                    type="text"
                    id="textColor"
                    value={settings.text_color}
                    onChange={(e) => handleFieldChange('text_color', e.target.value)}
                    placeholder="#19194D"
                  />
                </div>
                <span className="field-hint">Warna teks utama konten dan judul</span>
              </div>

              {/* Background Color */}
              <div className="color-field">
                <label htmlFor="backgroundColor">Background Color</label>
                <div className="color-input-wrapper">
                  <input
                    type="color"
                    id="backgroundColorPicker"
                    value={settings.background_color}
                    onChange={(e) => handleFieldChange('background_color', e.target.value)}
                    aria-label="Pilih Warna Latar"
                  />
                  <input
                    type="text"
                    id="backgroundColor"
                    value={settings.background_color}
                    onChange={(e) => handleFieldChange('background_color', e.target.value)}
                    placeholder="#F5F6FF"
                  />
                </div>
                <span className="field-hint">Latar belakang canvas utama aplikasi</span>
              </div>
            </div>
          </div>

          {/* Section 2: Typography */}
          <div className="admin-card">
            <div className="card-header">
              <div className="card-icon" style={{ backgroundColor: `${settings.secondary_color}18`, color: settings.secondary_color }}>
                <Icon name="doc" />
              </div>
              <div>
                <h2>Typography</h2>
                <p>Pengaturan font body dan font judul (Google Fonts)</p>
              </div>
            </div>

            <div className="form-fields-stack">
              {/* Font Family */}
              <div className="admin-form-group">
                <label htmlFor="fontFamily">Font Family</label>
                <div className="font-selector-row">
                  <input
                    type="text"
                    id="fontFamily"
                    value={settings.font_family}
                    onChange={(e) => handleFieldChange('font_family', e.target.value)}
                    placeholder="Contoh: Poppins, Inter, Plus Jakarta Sans"
                  />
                  <select
                    value={FONT_PRESETS.includes(settings.font_family) ? settings.font_family : ''}
                    onChange={(e) => e.target.value && handleFieldChange('font_family', e.target.value)}
                    aria-label="Pilih Preset Font Body"
                  >
                    <option value="">-- Preset Font --</option>
                    {FONT_PRESETS.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="field-hint">Digunakan untuk seluruh teks isi, label, dan tombol</span>
              </div>

              {/* Heading Font */}
              <div className="admin-form-group">
                <label htmlFor="headingFont">Heading Font</label>
                <div className="font-selector-row">
                  <input
                    type="text"
                    id="headingFont"
                    value={settings.heading_font}
                    onChange={(e) => handleFieldChange('heading_font', e.target.value)}
                    placeholder="Contoh: Poppins, Outfit, Montserrat"
                  />
                  <select
                    value={FONT_PRESETS.includes(settings.heading_font) ? settings.heading_font : ''}
                    onChange={(e) => e.target.value && handleFieldChange('heading_font', e.target.value)}
                    aria-label="Pilih Preset Font Judul"
                  >
                    <option value="">-- Preset Font --</option>
                    {FONT_PRESETS.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="field-hint">Digunakan untuk judul utama (h1, h2, h3, h4)</span>
              </div>
            </div>
          </div>

          {/* Section 3: Icon Settings */}
          <div className="admin-card">
            <div className="card-header">
              <div className="card-icon" style={{ backgroundColor: '#e9f95a55', color: '#14131a' }}>
                <Icon name="sliders" />
              </div>
              <div>
                <h2>Icon Settings</h2>
                <p>Kontrol ukuran proporsional icon menu profil dan tombol sign out</p>
              </div>
            </div>

            <div className="form-fields-stack">
              {/* Menu Icon Size (16px - 120px) */}
              <div className="admin-range-field">
                <div className="range-header">
                  <label htmlFor="menuIconSize">Menu Icon Size</label>
                  <div className="range-badge">
                    <input
                      type="number"
                      id="menuIconSizeInput"
                      min={16}
                      max={120}
                      value={settings.menu_icon_size}
                      onChange={(e) => handleFieldChange('menu_icon_size', Number(e.target.value) || 16)}
                    />
                    <span>px</span>
                  </div>
                </div>
                <input
                  type="range"
                  id="menuIconSize"
                  min={16}
                  max={120}
                  value={settings.menu_icon_size}
                  onChange={(e) => handleFieldChange('menu_icon_size', Number(e.target.value))}
                />
                <span className="field-hint">Ukuran icon pada item menu profile (Range: 16px — 120px, default: 42px)</span>
              </div>

              {/* Menu Icon Stroke (1 - 8) */}
              <div className="admin-range-field">
                <div className="range-header">
                  <label htmlFor="menuIconStroke">Menu Icon Stroke</label>
                  <div className="range-badge">
                    <input
                      type="number"
                      id="menuIconStrokeInput"
                      min={1}
                      max={8}
                      step={0.5}
                      value={settings.menu_icon_stroke}
                      onChange={(e) => handleFieldChange('menu_icon_stroke', Number(e.target.value) || 1)}
                    />
                    <span>px</span>
                  </div>
                </div>
                <input
                  type="range"
                  id="menuIconStroke"
                  min={1}
                  max={8}
                  step={0.5}
                  value={settings.menu_icon_stroke}
                  onChange={(e) => handleFieldChange('menu_icon_stroke', Number(e.target.value))}
                />
                <span className="field-hint">Ketebalan garis SVG icon menu (Range: 1 — 8, default: 2)</span>
              </div>

              {/* Sign Out Icon Size (16px - 160px) */}
              <div className="admin-range-field">
                <div className="range-header">
                  <label htmlFor="signoutIconSize">Sign Out Icon Size</label>
                  <div className="range-badge">
                    <input
                      type="number"
                      id="signoutIconSizeInput"
                      min={16}
                      max={160}
                      value={settings.signout_icon_size}
                      onChange={(e) => handleFieldChange('signout_icon_size', Number(e.target.value) || 16)}
                    />
                    <span>px</span>
                  </div>
                </div>
                <input
                  type="range"
                  id="signoutIconSize"
                  min={16}
                  max={160}
                  value={settings.signout_icon_size}
                  onChange={(e) => handleFieldChange('signout_icon_size', Number(e.target.value))}
                />
                <span className="field-hint">Ukuran icon Sign Out agar seimbang dan tidak memenuhi menu (Range: 16px — 160px, default: 64px)</span>
              </div>
            </div>
          </div>

          {/* Section 4: Branding (Upload Files) */}
          <div className="admin-card">
            <div className="card-header">
              <div className="card-icon" style={{ backgroundColor: '#ded6ff', color: '#5741d9' }}>
                <Icon name="camera" />
              </div>
              <div>
                <h2>Branding</h2>
                <p>Upload aset logo dan ikon visual dari perangkat Anda</p>
              </div>
            </div>

            <div className="branding-upload-grid">
              {/* Logo Upload */}
              <div className="upload-box">
                <label>Logo Aplikasi</label>
                <div className="upload-dropzone">
                  {logoPreview ? (
                    <div className="file-preview-content">
                      <img src={logoPreview} alt="Logo Preview" className="uploaded-thumb" />
                      <div className="file-meta">
                        <span className="file-name">{logoFileName}</span>
                        <span className="file-status">Preview Lokal</span>
                      </div>
                      <button
                        type="button"
                        className="btn-remove-file"
                        onClick={() => {
                          setLogoPreview(null);
                          setLogoFileName(null);
                        }}
                      >
                        Hapus
                      </button>
                    </div>
                  ) : (
                    <label className="file-select-trigger">
                      <Icon name="upload" />
                      <span>Pilih File Logo</span>
                      <small>PNG, JPG, WEBP, SVG</small>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={(e) => handleFileChange(e, setLogoPreview, setLogoFileName)}
                        hidden
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Menu Icon Upload */}
              <div className="upload-box">
                <label>Menu Icon</label>
                <div className="upload-dropzone">
                  {menuIconPreview ? (
                    <div className="file-preview-content">
                      <img src={menuIconPreview} alt="Menu Icon Preview" className="uploaded-thumb" />
                      <div className="file-meta">
                        <span className="file-name">{menuIconFileName}</span>
                        <span className="file-status">Preview Lokal</span>
                      </div>
                      <button
                        type="button"
                        className="btn-remove-file"
                        onClick={() => {
                          setMenuIconPreview(null);
                          setMenuIconFileName(null);
                        }}
                      >
                        Hapus
                      </button>
                    </div>
                  ) : (
                    <label className="file-select-trigger">
                      <Icon name="upload" />
                      <span>Pilih File Icon Menu</span>
                      <small>PNG, JPG, WEBP, SVG</small>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={(e) => handleFileChange(e, setMenuIconPreview, setMenuIconFileName)}
                        hidden
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Sign Out Icon Upload */}
              <div className="upload-box">
                <label>Sign Out Icon</label>
                <div className="upload-dropzone">
                  {signoutIconPreview ? (
                    <div className="file-preview-content">
                      <img src={signoutIconPreview} alt="Signout Icon Preview" className="uploaded-thumb" />
                      <div className="file-meta">
                        <span className="file-name">{signoutIconFileName}</span>
                        <span className="file-status">Preview Lokal</span>
                      </div>
                      <button
                        type="button"
                        className="btn-remove-file"
                        onClick={() => {
                          setSignoutIconPreview(null);
                          setSignoutIconFileName(null);
                        }}
                      >
                        Hapus
                      </button>
                    </div>
                  ) : (
                    <label className="file-select-trigger">
                      <Icon name="upload" />
                      <span>Pilih File Icon Sign Out</span>
                      <small>PNG, JPG, WEBP, SVG</small>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={(e) => handleFileChange(e, setSignoutIconPreview, setSignoutIconFileName)}
                        hidden
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="upload-server-note">
              <span className="note-badge">Pemberitahuan Sistem</span>
              <p>
                Bagian <strong>Preview File</strong> aktif secara lokal. Struktur frontend siap dihubungkan
                ke storage backend saat endpoint upload aset disediakan oleh server.
              </p>
            </div>
          </div>

          {/* Form Bottom Action Bar */}
          <div className="form-bottom-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowResetModal(true)}
              disabled={isSaving}
            >
              <Icon name="refresh" />
              <span>Reset Default</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ backgroundColor: settings.primary_color }}
              onClick={() => handleSave()}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <span className="spinner-auth" style={{ width: 16, height: 16, borderTopColor: '#fff' }} />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Icon name="check" />
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Real-Time Live Preview */}
        <div className="admin-live-preview-column">
          <div className="live-preview-sticky-card">
            <div className="preview-top-bar">
              <div className="preview-badge">
                <span className="live-pulsing-dot" />
                <span>LIVE PREVIEW REAL-TIME</span>
              </div>
              <span className="preview-help-text">Perubahan terlihat seketika</span>
            </div>

            {/* Mockup Canvas */}
            <div
              className="mockup-canvas"
              style={{
                backgroundColor: settings.background_color,
                color: settings.text_color,
                fontFamily: `"${settings.font_family}", sans-serif`,
              }}
            >
              {/* Mockup Header */}
              <div className="mockup-header" style={{ backgroundColor: settings.secondary_color }}>
                <div className="mockup-brand">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="mockup-logo-img" />
                  ) : (
                    <>
                      <span>Laporan</span>
                      <span style={{ color: settings.primary_color, marginLeft: 2, fontWeight: 800 }}>Wee</span>
                    </>
                  )}
                </div>

                <div className="mockup-profile-pill">
                  <div className="mockup-avatar" style={{ backgroundColor: settings.primary_color }}>
                    RA
                  </div>
                  <div className="mockup-profile-text">
                    <span className="mockup-name">{userName || 'Rangga Arya'}</span>
                    <span className="mockup-mail">{userEmail || 'rangga@wee.agency'}</span>
                  </div>
                </div>
              </div>

              {/* Mockup Profile Menu Dropdown Panel */}
              <div className="mockup-preview-section">
                <div className="mockup-section-label">
                  <span>Preview Menu Profil Dropdown:</span>
                </div>

                <div className="mockup-dropdown-box" style={{ borderColor: `${settings.text_color}18` }}>
                  {/* Item 1: Lihat Profil Saya */}
                  <div className="mockup-menu-item">
                    <div
                      className="mockup-icon-wrap"
                      style={{
                        width: `${settings.menu_icon_size}px`,
                        height: `${settings.menu_icon_size}px`,
                      }}
                    >
                      {menuIconPreview ? (
                        <img src={menuIconPreview} alt="Menu Icon" className="custom-icon-img" />
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={settings.primary_color}
                          strokeWidth={settings.menu_icon_stroke}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ width: '100%', height: '100%' }}
                        >
                          <path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-.5-1.5-.5-2.3c0-1 .8-1.7 1.8-1.7h1.4A4.3 4.3 0 0 0 21 12.5C21 7.3 17 3 12 3z" />
                          <circle cx="7.5" cy="10.5" r="1" />
                          <circle cx="10" cy="7" r="1" />
                          <circle cx="15" cy="7.5" r="1" />
                        </svg>
                      )}
                    </div>
                    <span className="mockup-item-text">Lihat Profil Saya</span>
                  </div>

                  {/* Item 2: Statistik & Analitik */}
                  <div className="mockup-menu-item">
                    <div
                      className="mockup-icon-wrap"
                      style={{
                        width: `${settings.menu_icon_size}px`,
                        height: `${settings.menu_icon_size}px`,
                      }}
                    >
                      {menuIconPreview ? (
                        <img src={menuIconPreview} alt="Menu Icon" className="custom-icon-img" />
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={settings.primary_color}
                          strokeWidth={settings.menu_icon_stroke}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ width: '100%', height: '100%' }}
                        >
                          <path d="M4 20V10M12 20V4M20 20v-7" />
                        </svg>
                      )}
                    </div>
                    <span className="mockup-item-text">Statistik & Analitik</span>
                  </div>

                  {/* Item 3: Salin Tautan Tim */}
                  <div className="mockup-menu-item">
                    <div
                      className="mockup-icon-wrap"
                      style={{
                        width: `${settings.menu_icon_size}px`,
                        height: `${settings.menu_icon_size}px`,
                      }}
                    >
                      {menuIconPreview ? (
                        <img src={menuIconPreview} alt="Menu Icon" className="custom-icon-img" />
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={settings.primary_color}
                          strokeWidth={settings.menu_icon_stroke}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ width: '100%', height: '100%' }}
                        >
                          <rect x="4" y="4" width="16" height="11" rx="1.5" />
                          <path d="M2 19h20" />
                        </svg>
                      )}
                    </div>
                    <span className="mockup-item-text">Salin Tautan Tim</span>
                  </div>

                  {/* Item 4: Keluar / Sign Out */}
                  <div
                    className="mockup-menu-item mockup-signout-item"
                    style={{ borderTop: `1px solid ${settings.text_color}14` }}
                  >
                    <div
                      className="mockup-icon-wrap"
                      style={{
                        width: `${settings.signout_icon_size}px`,
                        height: `${settings.signout_icon_size}px`,
                      }}
                    >
                      {signoutIconPreview ? (
                        <img src={signoutIconPreview} alt="Signout Icon" className="custom-icon-img" />
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#e14b4b"
                          strokeWidth={settings.menu_icon_stroke}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ width: '100%', height: '100%' }}
                        >
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                      )}
                    </div>
                    <span className="mockup-item-text" style={{ color: '#e14b4b', fontWeight: 700 }}>
                      Keluar (Sign Out)
                    </span>
                  </div>
                </div>
              </div>

              {/* Mockup Typography & Button Samples */}
              <div className="mockup-sample-elements">
                <h3
                  style={{
                    fontFamily: `"${settings.heading_font}", sans-serif`,
                    color: settings.secondary_color,
                    margin: '0 0 6px',
                  }}
                >
                  Judul Aplikasi Contoh
                </h3>
                <p style={{ margin: '0 0 12px', fontSize: '13px', opacity: 0.85 }}>
                  Teks paragraf ini menggunakan font <strong>{settings.font_family}</strong> dengan warna teks{' '}
                  <span style={{ fontWeight: 600 }}>{settings.text_color}</span>.
                </p>

                <div className="mockup-btn-row">
                  <button
                    type="button"
                    className="mockup-preview-btn"
                    style={{ backgroundColor: settings.primary_color, color: '#fff' }}
                  >
                    Tombol Utama
                  </button>
                  <div
                    className="mockup-chip"
                    style={{
                      backgroundColor: `${settings.secondary_color}14`,
                      color: settings.secondary_color,
                      borderColor: `${settings.secondary_color}30`,
                    }}
                  >
                    <span>Aksen Sekunder</span>
                  </div>
                </div>
              </div>

              {/* Mockup Specs Summary */}
              <div className="mockup-specs-summary">
                <div className="spec-item">
                  <span className="lbl">Menu Icon</span>
                  <span className="val">{settings.menu_icon_size}px</span>
                </div>
                <div className="spec-item">
                  <span className="lbl">Stroke</span>
                  <span className="val">{settings.menu_icon_stroke}px</span>
                </div>
                <div className="spec-item">
                  <span className="lbl">Sign Out</span>
                  <span className="val">{settings.signout_icon_size}px</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Reset Default */}
      {showResetModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-dialog">
            <div className="modal-header">
              <h3>Reset Pengaturan UI?</h3>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setShowResetModal(false)}
                aria-label="Tutup Dialog"
              >
                <Icon name="x" />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Apakah Anda yakin ingin mengembalikan seluruh pengaturan UI ke standar default LaporanWee?
              </p>
              <ul className="modal-reset-list">
                <li>Primary Color: <strong>#4A55FF</strong></li>
                <li>Secondary Color: <strong>#19194D</strong></li>
                <li>Font: <strong>Poppins</strong></li>
                <li>Menu Icon: <strong>42px</strong> (Stroke: <strong>2</strong>)</li>
                <li>Sign Out Icon: <strong>64px</strong></li>
              </ul>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowResetModal(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleResetConfirm}
              >
                Ya, Reset & Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
