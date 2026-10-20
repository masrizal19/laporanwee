import { UISettings } from '../types';
import { API_BASE_URL, normalizeFileUrl } from './api';

export const GLOBAL_UI_SETTINGS_API = `${API_BASE_URL}/ui-settings.php`;
export const ADMIN_UI_SETTINGS_API = `${API_BASE_URL}/ui/ui-settings.php`;
export const UI_SETTINGS_API = GLOBAL_UI_SETTINGS_API;
export const UI_UPLOAD_API = `${API_BASE_URL}/ui/ui-upload.php`;
export const ADMIN_EMAIL = 'rizalsaragih498@gmail.com';

export const DEFAULT_UI_SETTINGS: UISettings = {
  primary_color: '#4A55FF',
  secondary_color: '#19194D',
  text_color: '#19194D',
  background_color: '#F5F6FF',
  font_family: 'Poppins',
  heading_font: 'Poppins',
  menu_icon_size: 42,
  menu_icon_stroke: 2,
  signout_icon_size: 64,
  logo_url: null,
  menu_icon_url: null,
  signout_icon_url: null,
};

/**
 * Cache-busting helper for asset URLs (Rule 18)
 */
export const formatAssetUrlWithCacheBust = (
  rawUrl?: string | null,
  version?: string | number
): string | null => {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const clean = normalizeFileUrl(rawUrl);
  if (!clean) return null;
  if (clean.startsWith('data:') || clean.startsWith('blob:')) return clean;
  // Always strip any existing v= query param to prevent stale cache-busting
  const baseUrl = clean.replace(/([?&])v=[^&]*(&|$)/, '$1').replace(/[?&]$/, '');
  if (!version) return baseUrl;
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}v=${encodeURIComponent(String(version))}`;
};

/**
 * Extracts a reliable cache-busting version from updated_at, timestamp, or asset hash
 */
export const extractAssetVersion = (data: any): string | number => {
  if (!data) return Date.now();
  if (data.updated_at) {
    const parsed = new Date(data.updated_at).getTime();
    if (!isNaN(parsed) && parsed > 0) return parsed;
    return String(data.updated_at).replace(/[^a-zA-Z0-9]/g, '');
  }
  if (data.updatedAt) {
    const parsed = new Date(data.updatedAt).getTime();
    if (!isNaN(parsed) && parsed > 0) return parsed;
    return String(data.updatedAt).replace(/[^a-zA-Z0-9]/g, '');
  }
  if (data.logo_url && typeof data.logo_url === 'string') {
    const match = data.logo_url.match(/_([a-zA-Z0-9]+)\.(png|jpg|jpeg|webp|svg)/i);
    if (match && match[1]) {
      return match[1];
    }
  }
  return data.id || Date.now();
};

/**
 * Dynamically loads Google Fonts for the selected typography
 */
export const loadGoogleFont = (fonts: string[]) => {
  if (typeof document === 'undefined') return;
  const uniqueFonts = Array.from(new Set(fonts.filter(Boolean)));
  if (uniqueFonts.length === 0) return;

  const linkId = 'dynamic-ui-google-fonts';
  let link = document.getElementById(linkId) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  const query = uniqueFonts
    .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700;800`)
    .join('&');
  link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
};

/**
 * Applies UI settings to CSS variables on :root
 */
export const applyUISettingsToDocument = (settings: Partial<UISettings>) => {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const primary = settings.primary_color || DEFAULT_UI_SETTINGS.primary_color;
  const secondary = settings.secondary_color || DEFAULT_UI_SETTINGS.secondary_color;
  const text = settings.text_color || DEFAULT_UI_SETTINGS.text_color;
  const bg = settings.background_color || DEFAULT_UI_SETTINGS.background_color;
  const fontFamily = settings.font_family || DEFAULT_UI_SETTINGS.font_family;
  const headingFont = settings.heading_font || DEFAULT_UI_SETTINGS.heading_font;
  const menuIconSize = settings.menu_icon_size ?? DEFAULT_UI_SETTINGS.menu_icon_size;
  const menuIconStroke = settings.menu_icon_stroke ?? DEFAULT_UI_SETTINGS.menu_icon_stroke;
  const signoutIconSize = settings.signout_icon_size ?? DEFAULT_UI_SETTINGS.signout_icon_size;

  root.style.setProperty('--primary-color', primary);
  root.style.setProperty('--secondary-color', secondary);
  root.style.setProperty('--text-color', text);
  root.style.setProperty('--background-color', bg);
  root.style.setProperty('--font-family', `"${fontFamily}", sans-serif`);
  root.style.setProperty('--heading-font', `"${headingFont}", sans-serif`);
  root.style.setProperty('--menu-icon-size', `${menuIconSize}px`);
  root.style.setProperty('--menu-icon-stroke', `${menuIconStroke}`);
  root.style.setProperty('--signout-icon-size', `${signoutIconSize}px`);

  // Load web fonts
  loadGoogleFont([fontFamily, headingFont]);
};

/**
 * Resolves the admin email from parameter or local storage
 */
export const getAdminEmail = (explicitEmail?: string): string => {
  if (explicitEmail && explicitEmail.trim()) {
    return explicitEmail.trim();
  }
  try {
    const storedUser = localStorage.getItem('laporanwee_user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      if (parsed?.email) return parsed.email.trim();
    }
  } catch (_) {}

  const fallback =
    localStorage.getItem('userEmail') ||
    localStorage.getItem('email') ||
    localStorage.getItem('laporanwee_registered_email');
  return fallback ? fallback.trim() : '';
};

/**
 * Uploads an asset (logo, menu_icon, signout_icon) to the upload endpoint
 */
export const uploadUIAsset = async (
  file: File,
  assetType: 'logo' | 'menu_icon' | 'signout_icon',
  adminEmailParam?: string
): Promise<{ success: boolean; message: string; data: { asset: string; original_name: string; file_name: string; mime_type: string; size: number; url: string; }; admin_email: string; }> => {
  const adminEmail = getAdminEmail(adminEmailParam);

  if (!adminEmail) {
    throw {
      message: 'Admin belum terautentikasi. Silakan login kembali.',
      status: 401,
    };
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('asset', assetType);

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'X-Admin-Email': adminEmail,
  };

  const token = localStorage.getItem('laporanwee_token');
  if (token && token !== 'undefined' && token !== 'null') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log('[UI API] POST', UI_UPLOAD_API);
  console.log('[API REQUEST]', { method: 'POST (UPLOAD)', url: UI_UPLOAD_API });
  const response = await fetch(UI_UPLOAD_API, {
    method: 'POST',
    headers,
    body: formData,
  });

  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    console.error('[UI UPLOAD] Failed to parse JSON response. Status:', response.status, 'Body:', text);
    throw {
      message: `Server upload mengembalikan response tidak valid (${response.status})`,
      status: response.status,
    };
  }

  console.log('[UI UPLOAD] Upload response:', data);

  if (!response.ok || data.success === false) {
    console.error('[UI UPLOAD] Upload failed. Status:', response.status, 'Response body:', text);
    throw {
      message: data.message || `Gagal mengupload ${assetType}.`,
      status: response.status,
    };
  }

  // Ensure absolute public HTTPS url (Rule 16, 17)
  if (data.data?.url) {
    data.data.url = normalizeFileUrl(data.data.url);
  }

  console.log('[UI UPLOAD] Asset URL:', data.data?.url);
  return data;
};

/**
 * Fetches UI Settings from Backend API - Accessible by all users (Rule 5, 9, 10)
 */
export const fetchUISettings = async (adminEmailParam?: string): Promise<UISettings> => {
  // 1. Primary request: public GET /api/ui-settings.php without authentication restriction (Rule 5, 9, 10)
  try {
    const url = `${GLOBAL_UI_SETTINGS_API}?_t=${Date.now()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (response.ok) {
      const res = await response.json().catch(() => null);
      if (res && res.data) {
        console.log('[UISettings] Berhasil memuat global UI settings dari /api/ui-settings.php:', res.data);
        const version = extractAssetVersion(res.data);
        const mapped: UISettings = {
          ...DEFAULT_UI_SETTINGS,
          ...res.data,
          primary_color: res.data.primary_color || DEFAULT_UI_SETTINGS.primary_color,
          secondary_color: res.data.secondary_color || DEFAULT_UI_SETTINGS.secondary_color,
          text_color: res.data.text_color || DEFAULT_UI_SETTINGS.text_color,
          background_color: res.data.background_color || DEFAULT_UI_SETTINGS.background_color,
          font_family: res.data.font_family || DEFAULT_UI_SETTINGS.font_family,
          heading_font: res.data.heading_font || DEFAULT_UI_SETTINGS.heading_font,
          menu_icon_size: Number(res.data.menu_icon_size) || DEFAULT_UI_SETTINGS.menu_icon_size,
          menu_icon_stroke: Number(res.data.menu_icon_stroke) || DEFAULT_UI_SETTINGS.menu_icon_stroke,
          signout_icon_size: Number(res.data.signout_icon_size) || DEFAULT_UI_SETTINGS.signout_icon_size,
          logo_url: formatAssetUrlWithCacheBust(res.data.logo_url, version),
          menu_icon_url: formatAssetUrlWithCacheBust(res.data.menu_icon_url, version),
          signout_icon_url: formatAssetUrlWithCacheBust(res.data.signout_icon_url, version),
        };

        // Cache locally for instant loading on next visit (Rule 8)
        try {
          localStorage.setItem('laporanwee_ui_settings', JSON.stringify(mapped));
        } catch (_) {}

        // Global DOM application & event notification
        applyUISettingsToDocument(mapped);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ui-settings-updated', { detail: mapped }));
        }

        return mapped;
      }
    }
  } catch (err) {
    console.warn('[UISettings] Global GET from /api/ui-settings.php notice:', err);
  }

  // 2. Secondary fallback request: /api/ui/ui-settings.php with optional auth
  try {
    const adminEmail = getAdminEmail(adminEmailParam);
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (adminEmail) {
      headers['X-Admin-Email'] = adminEmail;
    }
    const token = localStorage.getItem('laporanwee_token');
    if (token && token !== 'undefined' && token !== 'null') {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${ADMIN_UI_SETTINGS_API}?_t=${Date.now()}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    if (response.ok) {
      const res = await response.json().catch(() => null);
      if (res && res.data) {
        console.log('[UISettings] Berhasil memuat settings dari fallback /api/ui/ui-settings.php:', res.data);
        const version = extractAssetVersion(res.data);
        const mapped: UISettings = {
          ...DEFAULT_UI_SETTINGS,
          ...res.data,
          primary_color: res.data.primary_color || DEFAULT_UI_SETTINGS.primary_color,
          secondary_color: res.data.secondary_color || DEFAULT_UI_SETTINGS.secondary_color,
          text_color: res.data.text_color || DEFAULT_UI_SETTINGS.text_color,
          background_color: res.data.background_color || DEFAULT_UI_SETTINGS.background_color,
          font_family: res.data.font_family || DEFAULT_UI_SETTINGS.font_family,
          heading_font: res.data.heading_font || DEFAULT_UI_SETTINGS.heading_font,
          menu_icon_size: Number(res.data.menu_icon_size) || DEFAULT_UI_SETTINGS.menu_icon_size,
          menu_icon_stroke: Number(res.data.menu_icon_stroke) || DEFAULT_UI_SETTINGS.menu_icon_stroke,
          signout_icon_size: Number(res.data.signout_icon_size) || DEFAULT_UI_SETTINGS.signout_icon_size,
          logo_url: formatAssetUrlWithCacheBust(res.data.logo_url, version),
          menu_icon_url: formatAssetUrlWithCacheBust(res.data.menu_icon_url, version),
          signout_icon_url: formatAssetUrlWithCacheBust(res.data.signout_icon_url, version),
        };
        try {
          localStorage.setItem('laporanwee_ui_settings', JSON.stringify(mapped));
        } catch (_) {}

        applyUISettingsToDocument(mapped);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ui-settings-updated', { detail: mapped }));
        }

        return mapped;
      }
    }
  } catch (fallbackErr) {
    console.warn('[UISettings] Fallback GET error:', fallbackErr);
  }

  // 3. Fallback from cached settings in localStorage (Rule 8)
  try {
    const cached = localStorage.getItem('laporanwee_ui_settings');
    if (cached) {
      const parsed = JSON.parse(cached);
      applyUISettingsToDocument(parsed);
      return parsed;
    }
  } catch (_) {}

  applyUISettingsToDocument(DEFAULT_UI_SETTINGS);
  return DEFAULT_UI_SETTINGS;
};

/**
 * Saves UI Settings to Backend API (Admin flow)
 */
export const saveUISettings = async (
  settings: Partial<UISettings>,
  adminEmailParam?: string
): Promise<any> => {
  const adminEmail = getAdminEmail(adminEmailParam);

  if (!adminEmail) {
    throw {
      message: 'Admin belum terautentikasi. Silakan login kembali.',
      status: 401,
    };
  }

  // Clean asset URLs from query params before saving to MySQL
  let cleanLogo = settings.logo_url !== undefined ? settings.logo_url : null;
  if (cleanLogo && typeof cleanLogo === 'string') {
    cleanLogo = cleanLogo.split('?')[0];
  }
  let cleanMenuIcon = settings.menu_icon_url !== undefined ? settings.menu_icon_url : null;
  if (cleanMenuIcon && typeof cleanMenuIcon === 'string') {
    cleanMenuIcon = cleanMenuIcon.split('?')[0];
  }
  let cleanSignoutIcon = settings.signout_icon_url !== undefined ? settings.signout_icon_url : null;
  if (cleanSignoutIcon && typeof cleanSignoutIcon === 'string') {
    cleanSignoutIcon = cleanSignoutIcon.split('?')[0];
  }

  const payload = {
    primary_color: settings.primary_color || DEFAULT_UI_SETTINGS.primary_color,
    secondary_color: settings.secondary_color || DEFAULT_UI_SETTINGS.secondary_color,
    text_color: settings.text_color || DEFAULT_UI_SETTINGS.text_color,
    background_color: settings.background_color || DEFAULT_UI_SETTINGS.background_color,
    font_family: settings.font_family || DEFAULT_UI_SETTINGS.font_family,
    heading_font: settings.heading_font || DEFAULT_UI_SETTINGS.heading_font,
    menu_icon_size: Number(settings.menu_icon_size) || DEFAULT_UI_SETTINGS.menu_icon_size,
    menu_icon_stroke: Number(settings.menu_icon_stroke) || DEFAULT_UI_SETTINGS.menu_icon_stroke,
    signout_icon_size: Number(settings.signout_icon_size) || DEFAULT_UI_SETTINGS.signout_icon_size,
    logo_url: cleanLogo,
    menu_icon_url: cleanMenuIcon,
    signout_icon_url: cleanSignoutIcon,
  };

  console.log('[UI SETTINGS] Admin email:', adminEmail);
  console.log('[UI SETTINGS] Saving payload:', payload);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Admin-Email': adminEmail,
  };

  const token = localStorage.getItem('laporanwee_token');
  if (token && token !== 'undefined' && token !== 'null') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log('[UI API] POST', ADMIN_UI_SETTINGS_API);
  console.log('[API REQUEST]', { method: 'POST', url: ADMIN_UI_SETTINGS_API });
  const response = await fetch(ADMIN_UI_SETTINGS_API, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    console.error('[UI SETTINGS] Save failed. Status:', response.status, 'Response body:', text);
    throw {
      message: `Server mengembalikan response tidak valid (${response.status})`,
      status: response.status,
    };
  }

  if (!response.ok || data.success === false) {
    console.error('[UI SETTINGS] Save failed. Status:', response.status, 'Response body:', text);
    if (response.status === 401) {
      throw { message: 'Admin belum terautentikasi. Silakan login kembali.', status: 401 };
    }
    if (response.status === 403) {
      throw { message: 'Akses admin ditolak.', status: 403 };
    }
    if (response.status >= 500) {
      throw { message: 'Gagal menyimpan pengaturan UI karena masalah server.', status: response.status };
    }
    throw {
      message: data.message || 'Gagal menyimpan pengaturan UI.',
      status: response.status,
    };
  }

  console.log('[UI SETTINGS] Save response:', data);

  // Immediately re-fetch and re-apply settings
  const fresh = await fetchUISettings(adminEmail).catch(() => null);
  if (fresh) {
    applyUISettingsToDocument(fresh);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ui-settings-updated', { detail: fresh }));
    }
  }

  return data;
};
