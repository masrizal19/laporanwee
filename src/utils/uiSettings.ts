import { UISettings } from '../types';
import { api, getHeaders } from './api';

export const UI_SETTINGS_API = 'https://api-laporanwe.mkverse.my.id/api/ui/ui-settings.php';
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
 * Fetches UI Settings from Backend API
 */
export const fetchUISettings = async (adminEmailParam?: string): Promise<UISettings> => {
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

  try {
    const response = await fetch(UI_SETTINGS_API, {
      method: 'GET',
      headers,
    });
    const text = await response.text();
    let res: any = {};
    try {
      res = text ? JSON.parse(text) : {};
    } catch {
      res = {};
    }

    if (res && res.data) {
      return {
        ...DEFAULT_UI_SETTINGS,
        ...res.data,
        menu_icon_size: Number(res.data.menu_icon_size) || DEFAULT_UI_SETTINGS.menu_icon_size,
        menu_icon_stroke: Number(res.data.menu_icon_stroke) || DEFAULT_UI_SETTINGS.menu_icon_stroke,
        signout_icon_size: Number(res.data.signout_icon_size) || DEFAULT_UI_SETTINGS.signout_icon_size,
      };
    }
    return DEFAULT_UI_SETTINGS;
  } catch (err) {
    console.warn('[UISettings] Gagal mengambil settings dari API, gunakan fallback default:', err);
    throw err;
  }
};

/**
 * Saves UI Settings to Backend API
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
  };

  // Safe debugging logs requested by prompt
  console.log('[UI SETTINGS] Admin email:', adminEmail);
  console.log('[UI SETTINGS] Sending POST:', payload);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Admin-Email': adminEmail,
  };

  const token = localStorage.getItem('laporanwee_token');
  if (token && token !== 'undefined' && token !== 'null') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(UI_SETTINGS_API, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw {
      message: `Server mengembalikan response tidak valid (${response.status})`,
      status: response.status,
    };
  }

  if (!response.ok || data.success === false) {
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

  return data;
};
