export interface RegisteredApp {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  status: 'available' | 'maintenance';
  statusLabel: string;
  sourceUrl: string;
  iconType: 'camera';
}

export const REGISTERED_APPS: RegisteredApp[] = [
  {
    id: 'fotowe',
    slug: 'Fotowe',
    name: 'FOTOWE',
    category: 'Desain & Fotografi',
    description:
      'Aplikasi editor foto dan pas foto digital untuk membuat, mengatur, dan mencetak pas foto dengan berbagai ukuran.',
    status: 'available',
    statusLabel: 'Tersedia',
    sourceUrl: '/fotowe/studio.html',
    iconType: 'camera',
  },
];

export function findAppBySlug(slug?: string | null): RegisteredApp | undefined {
  if (!slug) return undefined;
  const normalized = slug.trim().toLowerCase();
  return REGISTERED_APPS.find(
    (app) => app.slug.toLowerCase() === normalized || app.id.toLowerCase() === normalized
  );
}
