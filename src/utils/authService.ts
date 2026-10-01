import { API_BASE_URL, buildApiUrl } from './api';

/**
 * Mask email address for privacy (e.g. rizal****@gmail.com)
 */
export const maskEmail = (email: string): string => {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return email || '';
  }
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local}****@${domain}`;
  }
  const visibleLen = Math.min(4, Math.max(2, Math.floor(local.length / 2)));
  const visible = local.slice(0, visibleLen);
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
  const url = buildApiUrl('/resend-verification.php');
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
    message: data.message || 'Email verifikasi telah dikirim ulang.',
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
 * Verify email token with backend
 * GET ${VITE_API_URL}/verify-email.php?token=TOKEN
 */
export const verifyEmailToken = async (
  token: string
): Promise<VerifyEmailResult> => {
  const cleanToken = token.trim();
  if (!cleanToken) {
    return {
      status: 'invalid',
      message: 'Token verifikasi tidak ditemukan.',
    };
  }

  const url = buildApiUrl(`/verify-email.php?token=${encodeURIComponent(cleanToken)}`);
  console.log('[API REQUEST]', { method: 'GET', url });

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
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
  const userEmail = data.email || data.user?.email || data.data?.email;

  // 1. Success check
  if (response.ok && data.success !== false) {
    if (
      code === 'ALREADY_VERIFIED' ||
      lowerMsg.includes('sudah diverifikasi') ||
      lowerMsg.includes('already verified')
    ) {
      return {
        status: 'already_verified',
        message: rawMsg || 'Email Sudah Diverifikasi',
        email: userEmail,
      };
    }
    return {
      status: 'success',
      message: rawMsg || 'Email Berhasil Diverifikasi',
      email: userEmail,
    };
  }

  // 2. Specific failure states
  if (
    response.status === 410 ||
    code === 'TOKEN_EXPIRED' ||
    code === 'EXPIRED' ||
    lowerMsg.includes('kedaluwarsa') ||
    lowerMsg.includes('expired')
  ) {
    return {
      status: 'expired',
      message: rawMsg || 'Link verifikasi ini sudah tidak berlaku. Silakan kirim ulang email verifikasi.',
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
      message: rawMsg || 'Email Sudah Diverifikasi',
      email: userEmail,
    };
  }

  if (
    response.status === 400 ||
    code === 'TOKEN_INVALID' ||
    code === 'INVALID' ||
    lowerMsg.includes('tidak valid') ||
    lowerMsg.includes('invalid')
  ) {
    return {
      status: 'invalid',
      message: rawMsg || 'Link verifikasi tidak valid atau sudah tidak dapat digunakan.',
      email: userEmail,
    };
  }

  return {
    status: 'error',
    message: rawMsg || 'Terjadi kendala saat memverifikasi email Anda.',
    email: userEmail,
  };
};
