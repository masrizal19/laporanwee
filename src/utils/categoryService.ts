export interface WorkCategory {
  id: string;
  name: string;
  icon?: string;
  active: boolean;
  is_default?: boolean;
}

const STORAGE_KEY = 'laporanwee_work_categories';

export const DEFAULT_WORK_CATEGORIES: WorkCategory[] = [
  { id: 'cat-1', name: 'Desain & UI/UX', icon: '🎨', active: true, is_default: true },
  { id: 'cat-2', name: 'Videografi & Editing', icon: '🎬', active: true, is_default: true },
  { id: 'cat-3', name: 'Fotografi & Retouch', icon: '📸', active: true, is_default: true },
  { id: 'cat-4', name: 'Frontend Development', icon: '💻', active: true, is_default: true },
  { id: 'cat-5', name: 'Copywriting & Strategy', icon: '📢', active: true, is_default: true },
];

export const categoryService = {
  getAllCategories: (): WorkCategory[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (_) {}
    return DEFAULT_WORK_CATEGORIES;
  },

  getActiveCategories: (): WorkCategory[] => {
    const all = categoryService.getAllCategories();
    return all.filter((c) => c.active !== false);
  },

  addCategory: (name: string, icon = '📁'): WorkCategory => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Nama kategori wajib diisi.');
    const all = categoryService.getAllCategories();
    if (all.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`Kategori "${trimmed}" sudah ada.`);
    }
    const newCat: WorkCategory = {
      id: `cat_${Date.now()}`,
      name: trimmed,
      icon,
      active: true,
    };
    const updated = [...all, newCat];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return newCat;
  },

  updateCategory: (id: string, name: string, icon?: string): WorkCategory => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Nama kategori wajib diisi.');
    const all = categoryService.getAllCategories();
    const updated = all.map((c) => {
      if (c.id === id) {
        return { ...c, name: trimmed, ...(icon ? { icon } : {}) };
      }
      return c;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    const found = updated.find((c) => c.id === id);
    if (!found) throw new Error('Kategori tidak ditemukan.');
    return found;
  },

  toggleCategoryActive: (id: string): WorkCategory => {
    const all = categoryService.getAllCategories();
    const updated = all.map((c) => {
      if (c.id === id) {
        return { ...c, active: !c.active };
      }
      return c;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    const found = updated.find((c) => c.id === id);
    if (!found) throw new Error('Kategori tidak ditemukan.');
    return found;
  },

  deleteCategory: (id: string): void => {
    const all = categoryService.getAllCategories();
    const target = all.find((c) => c.id === id);
    if (target?.is_default) {
      throw new Error('Kategori bawaan sistem tidak dapat dihapus permanen (bisa dinonaktifkan).');
    }
    const updated = all.filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  ensureCategoryExists: (name?: string): void => {
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const all = categoryService.getAllCategories();
    if (!all.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      const newCat: WorkCategory = {
        id: `cat_${Date.now()}_custom`,
        name: trimmed,
        icon: '📁',
        active: true,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...all, newCat]));
    }
  },
};
