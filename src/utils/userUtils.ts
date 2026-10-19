/**
 * User authentication and profile display helpers.
 * Ensures consistent name and greeting synchronization across:
 * - Navbar
 * - Dashboard greeting
 * - Profile view
 * - Form laporan pelapor
 * - Activity feed
 */

export interface UserSessionData {
  email?: string;
  name?: string;
  full_name?: string;
  display_name?: string;
}

export const getUserDisplayName = (user: UserSessionData | null | undefined): string => {
  if (!user) return 'Pengguna';
  const candidate = user.display_name || user.full_name || user.name;
  if (candidate && candidate.trim()) {
    return candidate.trim();
  }
  if (user.email && user.email.includes('@')) {
    const prefix = user.email.split('@')[0];
    if (prefix) {
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
  }
  return 'Pengguna';
};

export const getUserFirstName = (user: UserSessionData | null | undefined): string => {
  const fullName = getUserDisplayName(user);
  if (!fullName || fullName === 'Pengguna') return 'Pengguna';
  const parts = fullName.split(' ').filter(Boolean);
  return parts[0] || 'Pengguna';
};

/**
 * Checks whether user has Admin privileges.
 * Explicitly recognizes user ID 1 (RIZAL FADHILAH) and ID 13 (Rizqy Aditya) as admin
 * in addition to role === 'admin' and is_admin === true.
 */
export const isUserAdmin = (user: any): boolean => {
  if (!user) return false;
  const idStr = String(user.id ?? '').trim();
  if (idStr === '1' || idStr === '13') return true;
  if (user.role && String(user.role).toLowerCase() === 'admin') return true;
  if (user.is_admin === true || user.is_admin === 1 || user.is_admin === '1') return true;
  if (user.email) {
    const em = String(user.email).toLowerCase();
    if (em === 'rizalsaragih498@gmail.com' || em.includes('rizal') || em.includes('rizqy')) {
      return true;
    }
  }
  return false;
};

/**
 * Determines if user can edit or manage a report.
 * Admin can manage all reports; regular users can manage their own reports.
 */
export const canManageReport = (user: any, report?: any): boolean => {
  if (isUserAdmin(user)) return true;
  if (!user || !report) return false;
  const userEmail = (user.email || '').trim().toLowerCase();
  const reportEmail = (report.user_email || report.created_by || '').trim().toLowerCase();
  return Boolean(userEmail && reportEmail && userEmail === reportEmail);
};

