export interface RegisteredApp {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  status: 'available' | 'maintenance';
  statusLabel: string;
  sourceUrl: string;
  iconType: 'camera' | 'music';
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
    sourceUrl: '/Aplikasi/Fotowe',
    iconType: 'camera',
  },
  {
    id: 'musikwe',
    slug: 'Musikwe',
    name: 'MusikWe (.MUSIKWE)',
    category: 'Musik & Hiburan Tim',
    description:
      'Pemutar musik kolaboratif dengan antrean request, voting lagu, lirik sinkron, playlist, serta pemutaran YouTube dan audio.',
    status: 'available',
    statusLabel: 'Tersedia',
    sourceUrl: '/Aplikasi/Musikwe',
    iconType: 'music',
  },
];

export function findAppBySlug(slug?: string | null): RegisteredApp | undefined {
  if (!slug) return undefined;
  const normalized = slug.trim().toLowerCase();
  return REGISTERED_APPS.find(
    (app) => app.slug.toLowerCase() === normalized || app.id.toLowerCase() === normalized
  );
}
