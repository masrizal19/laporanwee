import { API_BASE_URL, buildApiUrl } from './api';

/**
 * Mask email address for privacy (e.g. riza****@gmail.com)
 */
export const maskEmail = (email: string): string => {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return email || '';
  }
  const [local, domain] = email.split('@');
  if (local.length <= 4) {
    const visiblePrefix = local.slice(0, Math.max(1, local.length - 1));
    return `${visiblePrefix}****@${domain}`;
  }
  const visible = local.slice(0, 4);
  return `${visible}****@${domain}`;
};

/**
 * Opens user's webmail provider in a new tab if supported
 */
export const openWebmail = (email: string) => {
  if (!email || !email.includes('@')) {
    window.open('https://mail.google.com', '_blank');
    return;
  }
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    window.open('https://mail.google.com', '_blank');
  } else if (domain === 'yahoo.com' || domain === 'ymail.com') {
    window.open('https://mail.yahoo.com', '_blank');
  } else if (
    domain === 'outlook.com' ||
    domain === 'hotmail.com' ||
    domain === 'live.com' ||
    domain === 'msn.com'
  ) {
    window.open('https://outlook.live.com', '_blank');
  } else if (domain === 'icloud.com') {
    window.open('https://www.icloud.com/mail', '_blank');
  } else {
    window.open(`https://${domain}`, '_blank');
  }
};

/**
 * Resend verification email to user
 * POST ${VITE_API_URL}/resend-verification.php
 */
export const resendVerificationEmail = async (
  email: string
): Promise<{ success: boolean; message: string }> => {
  const url = buildApiUrl('/email/resend-verification.php');
  console.log('[API REQUEST]', { method: 'POST', url, email: maskEmail(email) });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });

  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Server mengembalikan response tidak valid (${response.status})`);
  }

  if (!response.ok || data.success === false) {
    throw new Error(
      data.message || data.error || 'Gagal mengirim ulang email verifikasi.'
    );
  }

  return {
    success: true,
    message: data.message || 'Email verifikasi berhasil dikirim ulang.',
  };
};

export type VerifyEmailStatus =
  | 'loading'
  | 'success'
  | 'expired'
  | 'invalid'
  | 'already_verified'
  | 'error';

export interface VerifyEmailResult {
  status: VerifyEmailStatus;
  message: string;
  email?: string;
}

/**
 * Verify email with backend
 * POST https://api-laporanwe.mkverse.my.id/api/email/verify-email.php
 * Body: { email: "...", token: "..." }
 */
export const verifyEmailToken = async (
  emailOrToken: string,
  maybeToken?: string
): Promise<VerifyEmailResult> => {
  let email = '';
  let token = '';

  if (typeof maybeToken === 'string') {
    email = emailOrToken.trim();
    token = maybeToken.trim();
  } else {
    // If only one parameter passed, detect if it has @
    if (emailOrToken.includes('@')) {
      email = emailOrToken.trim();
    } else {
      token = emailOrToken.trim();
    }
  }

  if (!email || !token) {
    return {
      status: 'invalid',
      message:
        !email && !token
          ? 'Email dan token verifikasi tidak ditemukan dalam URL.'
          : !token
          ? 'Token verifikasi tidak ditemukan dalam URL.'
          : 'Alamat email verifikasi tidak ditemukan dalam URL.',
      email: email || undefined,
    };
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanToken = token.trim();
  const url = buildApiUrl('/email/verify-email.php');
  console.log('[API REQUEST]', { method: 'POST', url, email: cleanEmail, tokenLength: cleanToken.length });

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email: cleanEmail,
        token: cleanToken,
      }),
    });
  } catch (err: any) {
    return {
      status: 'error',
      message: 'Tidak dapat terhubung ke server verifikasi. Periksa koneksi internet Anda.',
      email: cleanEmail,
    };
  }

  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return {
      status: 'error',
      message: `Server mengembalikan response tidak valid (${response.status})`,
      email: cleanEmail,
    };
  }

  const code = String(data.code || data.error_code || '').toUpperCase();
  const rawMsg =
    typeof data.message === 'string'
      ? data.message
      : typeof data.error === 'string'
      ? data.error
      : '';
  const lowerMsg = rawMsg.toLowerCase();
  const userEmail = data.email || data.user?.email || data.data?.email || cleanEmail;

  // 1. Success check
  if (response.ok && data.success === true) {
    if (
      code === 'ALREADY_VERIFIED' ||
      lowerMsg.includes('sudah diverifikasi') ||
      lowerMsg.includes('already verified')
    ) {
      return {
        status: 'already_verified',
        message: rawMsg || 'Email sudah diverifikasi sebelumnya. Akun sudah dapat digunakan untuk login.',
        email: userEmail,
      };
    }
    return {
      status: 'success',
      message: rawMsg || 'Email berhasil diverifikasi dan akun sudah dapat digunakan untuk login.',
      email: userEmail,
    };
  }

  // 2. Specific failure states based on backend response
  if (
    response.status === 410 ||
    code === 'TOKEN_EXPIRED' ||
    code === 'EXPIRED' ||
    lowerMsg.includes('kedaluwarsa') ||
    lowerMsg.includes('expired')
  ) {
    return {
      status: 'expired',
      message: rawMsg || 'Token verifikasi telah kedaluwarsa. Silakan kirim ulang email verifikasi.',
      email: userEmail,
    };
  }

  if (
    code === 'ALREADY_VERIFIED' ||
    lowerMsg.includes('sudah diverifikasi') ||
    lowerMsg.includes('already verified')
  ) {
    return {
      status: 'already_verified',
      message: rawMsg || 'Email sudah diverifikasi sebelumnya. Akun sudah dapat digunakan untuk login.',
      email: userEmail,
    };
  }

  if (
    response.status === 400 ||
    response.status === 422 ||
    code === 'TOKEN_INVALID' ||
    code === 'INVALID' ||
    lowerMsg.includes('tidak valid') ||
    lowerMsg.includes('invalid') ||
    lowerMsg.includes('tidak sesuai')
  ) {
    return {
      status: 'invalid',
      message: rawMsg || 'Token verifikasi tidak valid atau sudah tidak berlaku.',
      email: userEmail,
    };
  }

  return {
    status: 'error',
    message: rawMsg || 'Terjadi kendala saat memverifikasi email Anda.',
    email: userEmail,
  };
};
