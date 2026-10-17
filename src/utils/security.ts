/**
 * Frontend Web Security Utilities
 * Protects against XSS, open redirection, reverse tabnabbing, and dangerous URI schemes.
 */

const DANGEROUS_PROTOCOLS = ['javascript:', 'data:', 'vbscript:', 'file:', 'blob:'];

/**
 * Validates and sanitizes an external URL to ensure it only uses safe http/https schemes.
 * Rejects malicious schemes like javascript:, data:, etc.
 */
export function sanitizeExternalUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();

  // Strip non-printable ASCII and control characters
  const clean = trimmed.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  if (!clean || clean === '#') return '';

  const lower = clean.toLowerCase();
  for (const proto of DANGEROUS_PROTOCOLS) {
    if (lower.startsWith(proto)) {
      console.warn('[SECURITY] Blocked potentially unsafe protocol in URL:', clean);
      return '';
    }
  }

  // Allow standard web protocols
  if (/^https?:\/\//i.test(clean)) {
    return clean;
  }

  // Normalize bare domains like "instagram.com/user" to https://
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/i.test(clean)) {
    return `https://${clean}`;
  }

  return '';
}

/**
 * Safely opens an external URL in a new window/tab preventing reverse tabnabbing
 * and blocking dangerous script execution.
 */
export function safeOpenExternalUrl(rawUrl?: string | null): void {
  const safeUrl = sanitizeExternalUrl(rawUrl);
  if (!safeUrl) {
    console.warn('[SECURITY] Attempted to open invalid or unsafe URL:', rawUrl);
    return;
  }
  // noopener and noreferrer prevent the target window from accessing window.opener
  window.open(safeUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Strips dangerous HTML tags and script-like tokens from user text input
 * to guard against stored and reflected cross-site scripting (XSS).
 */
export function sanitizeTextInput(input?: string | null): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/onerror\s*=/gi, '')
    .replace(/onload\s*=/gi, '')
    .replace(/onclick\s*=/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

/**
 * Normalizes and sanitizes a social media handle (e.g. "@smk_multikarya_official")
 */
export function sanitizeHandle(rawHandle?: string | null): string {
  if (!rawHandle || typeof rawHandle !== 'string') return '';
  const cleaned = rawHandle.trim().replace(/[^a-zA-Z0-9._@-]/g, '');
  if (!cleaned) return '';
  return cleaned.startsWith('@') ? cleaned : `@${cleaned}`;
}
