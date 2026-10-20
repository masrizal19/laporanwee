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
