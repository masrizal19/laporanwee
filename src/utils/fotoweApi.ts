import { buildApiUrl, getStoredToken } from './api';

export interface FotowePermissionEntry {
  user_id?: number | null;
  user_email: string;
  full_name?: string;
  permission: 'viewer' | 'editor';
}

export interface FotoweSlotPayload {
  slot_index: number;
  photo_id?: number | null;
  photo_url?: string | null;
  cors_url?: string | null;
  thumb_url?: string | null;
  name?: string;
  file_size?: number;
  z: number;
  ox: number;
  oy: number;
  status: 'empty' | 'filled';
}

export interface FotoweArtboardPayload {
  id: string;
  name: string;
  t: string;
  s: number;
  a: number;
  thumbnail_url?: string | null;
  slots: FotoweSlotPayload[];
}

export interface FotoweProjectSummary {
  id: string;
  name: string;
  dpi: number;
  color: 'rgb' | 'gray';
  active: number;
  n: number;
  photos: number;
  thumbnail_url?: string | null;
  visibility?: 'workspace' | 'private';
  version?: number;
  owner_user_id: number;
  owner_name: string;
  owner_email: string;
  is_owner: boolean;
  is_admin?: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_manage_permissions: boolean;
  access_role: 'admin' | 'owner' | 'editor' | 'viewer';
  saved: number;
  updated_at?: string;
}

export interface FotoweProjectDetail extends FotoweProjectSummary {
  artboards: FotoweArtboardPayload[];
  permissions: FotowePermissionEntry[];
}

export interface UploadedFotowePhoto {
  photo_id: number;
  photo_key: string;
  original_name: string;
  file_url: string;
  cors_url: string;
  thumb_url: string;
  thumb_cors_url?: string;
  mime_type: string;
  file_size: number;
  width: number;
  height: number;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...extra,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function parseApiResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const err = new Error(
      (json && json.message) ||
        `Server FOTOWE merespons HTTP ${res.status}. Pastikan endpoint /api/fotowe/ aktif.`
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  if (!json || json.success !== true) {
    const err = new Error(
      (json && json.message) || 'Permintaan ke server FOTOWE gagal.'
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return json as T;
}

export const fotoweApi = {
  async listProjects(): Promise<FotoweProjectSummary[]> {
    const res = await fetch(buildApiUrl('/fotowe/projects/read.php'), {
      method: 'GET',
      cache: 'no-store',
      headers: authHeaders(),
    });
    const json = await parseApiResponse<{ data?: FotoweProjectSummary[]; projects?: FotoweProjectSummary[] }>(res);
    const list = Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.projects)
      ? json.projects
      : [];
    return list;
  },

  async getProjectDetail(projectId: string): Promise<FotoweProjectDetail> {
    const url = buildApiUrl(`/fotowe/projects/detail.php?id=${encodeURIComponent(projectId)}`);
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: authHeaders(),
    });
    const json = await parseApiResponse<{ data: FotoweProjectDetail }>(res);
    return json.data;
  },

  async createProject(payload: {
    id?: string;
    name: string;
    dpi: number;
    color: 'rgb' | 'gray';
    active: number;
    thumbnail_data?: string | null;
    thumbnail_url?: string | null;
    visibility?: 'workspace' | 'private';
    artboards: FotoweArtboardPayload[];
    permissions?: FotowePermissionEntry[];
  }): Promise<FotoweProjectSummary> {
    const res = await fetch(buildApiUrl('/fotowe/projects/create.php'), {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    const json = await parseApiResponse<{ data: FotoweProjectSummary }>(res);
    return json.data;
  },

  async updateProject(payload: {
    id: string;
    name?: string;
    dpi?: number;
    color?: 'rgb' | 'gray';
    active?: number;
    thumbnail_data?: string | null;
    thumbnail_url?: string | null;
    visibility?: 'workspace' | 'private';
    artboards?: FotoweArtboardPayload[];
    permissions?: FotowePermissionEntry[];
  }): Promise<FotoweProjectSummary> {
    const res = await fetch(buildApiUrl('/fotowe/projects/update.php'), {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    const json = await parseApiResponse<{ data: FotoweProjectSummary }>(res);
    return json.data;
  },

  async deleteProject(projectId: string): Promise<void> {
    const res = await fetch(buildApiUrl('/fotowe/projects/delete.php'), {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id: projectId }),
    });
    await parseApiResponse<{ deleted_id?: string }>(res);
  },

  async uploadPhoto(blob: Blob, fileName: string): Promise<UploadedFotowePhoto> {
    const formData = new FormData();
    const cleanName = fileName && fileName.trim() ? fileName.trim() : 'foto.jpg';
    formData.append('photo', blob, cleanName);

    const res = await fetch(buildApiUrl('/fotowe/upload.php'), {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    const json = await parseApiResponse<{ data: UploadedFotowePhoto }>(res);
    return json.data;
  },

  async deletePhoto(photoId: number): Promise<void> {
    const res = await fetch(buildApiUrl('/fotowe/delete.php'), {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ photo_id: photoId }),
    });
    await parseApiResponse(res);
  },
};

// Shared in-memory Blob cache so duplicated/reopened photos are loaded once cleanly
const remoteBlobCache = new Map<string, Blob>();

export async function fetchPhotoBlobCorsSafe(urls: {
  corsUrl?: string | null;
  photoUrl?: string | null;
  photoId?: number | null;
}): Promise<Blob | null> {
  const candidates: string[] = [];
  if (urls.corsUrl) candidates.push(urls.corsUrl);
  if (urls.photoId) {
    const proxyUrl = buildApiUrl(`/fotowe/file.php?id=${encodeURIComponent(String(urls.photoId))}`);
    if (!candidates.includes(proxyUrl)) candidates.push(proxyUrl);
  }
  if (urls.photoUrl && !candidates.includes(urls.photoUrl)) {
    candidates.push(urls.photoUrl);
  }

  for (const url of candidates) {
    const cached = remoteBlobCache.get(url);
    if (cached) return cached;

    try {
      const res = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'force-cache',
      });
      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 0) {
          remoteBlobCache.set(url, blob);
          if (urls.photoUrl) remoteBlobCache.set(urls.photoUrl, blob);
          return blob;
        }
      }
    } catch {
      // Try next URL candidate
    }
  }

  return null;
}

export function rememberPhotoBlob(url: string | null | undefined, blob: Blob) {
  if (url && blob) {
    remoteBlobCache.set(url, blob);
  }
}

/* ==========================================================================
   Safe One-Time IndexedDB -> MySQL Migration
   - Scans both legacy 'fotowe' DB and user-scoped 'fotowe_u_*' DBs
   - Uploads every photo Blob and creates full project + artboards on server
   - ONLY deletes each IndexedDB record after server confirms 100% success
   ========================================================================== */

function openDbIfExists(dbName: string): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    let createdNew = false;
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      createdNew = true;
      if (!req.result.objectStoreNames.contains('p')) {
        req.result.createObjectStore('p');
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      if (createdNew) {
        // DB didn't exist prior to this check — close & delete empty shell
        db.close();
        try {
          indexedDB.deleteDatabase(dbName);
        } catch {}
        resolve(null);
        return;
      }
      resolve(db);
    };
    req.onerror = () => resolve(null);
  });
}

function readAllEntriesFromStore(
  db: IDBDatabase
): Promise<Array<{ key: IDBValidKey; value: any }>> {
  return new Promise((resolve) => {
    if (!db.objectStoreNames.contains('p')) {
      resolve([]);
      return;
    }
    try {
      const tx = db.transaction('p', 'readonly');
      const store = tx.objectStore('p');
      const items: Array<{ key: IDBValidKey; value: any }> = [];
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          items.push({ key: cursor.key, value: cursor.value });
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve(items);
      tx.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

function deleteEntryFromStore(db: IDBDatabase, key: IDBValidKey): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('p', 'readwrite');
      tx.objectStore('p').delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function migrateIndexedDbProjects(
  userScopeIdentity: string | number
): Promise<{ migratedCount: number; failedCount: number }> {
  const scopeSlug = String(userScopeIdentity || 'anon')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');

  const candidateDbNames = Array.from(
    new Set([`fotowe_u_${scopeSlug}`, 'fotowe', 'fotowe_u_anon'])
  );

  // Verify server availability first before reading/migrating
  let serverProjectIds: Set<string>;
  try {
    const serverProjects = await fotoweApi.listProjects();
    serverProjectIds = new Set(serverProjects.map((p) => p.id));
  } catch {
    return { migratedCount: 0, failedCount: 0 };
  }

  let migratedCount = 0;
  let failedCount = 0;

  for (const dbName of candidateDbNames) {
    const db = await openDbIfExists(dbName);
    if (!db) continue;

    try {
      const entries = await readAllEntriesFromStore(db);
      for (const entry of entries) {
        const raw = entry.value;
        if (!raw || typeof raw !== 'object') continue;

        // Normalize legacy 'current' format vs multi-artboard format
        const rawImages: Array<{ blob?: Blob; name?: string }> = Array.isArray(raw.images)
          ? raw.images
          : [];
        const rawArtboards: any[] = Array.isArray(raw.artboards)
          ? raw.artboards
          : Array.isArray(raw.slots)
          ? [
              {
                id: 'legacy_ab_1',
                name: 'Artboard 1',
                t: raw.t || '4R',
                s: raw.s ?? 1,
                a: raw.a ?? 0,
                slots: raw.slots,
              },
            ]
          : [];

        if (!rawArtboards.length) continue;

        const projId = String(raw.id || `migr_${Date.now().toString(36)}`);
        if (serverProjectIds.has(projId)) {
          // Verify project detail really exists on server before clearing local copy
          try {
            await fotoweApi.getProjectDetail(projId);
            await deleteEntryFromStore(db, entry.key);
          } catch {
            // Keep local backup until verified
          }
          continue;
        }

        try {
          // 1. Upload all image blobs referenced by this project
          const uploadedImages: Array<UploadedFotowePhoto | null> = [];
          for (let i = 0; i < rawImages.length; i++) {
            const imgEntry = rawImages[i];
            if (imgEntry && imgEntry.blob instanceof Blob && imgEntry.blob.size > 0) {
              const uploaded = await fotoweApi.uploadPhoto(
                imgEntry.blob,
                imgEntry.name || `foto-${i + 1}.jpg`
              );
              rememberPhotoBlob(uploaded.cors_url, imgEntry.blob);
              rememberPhotoBlob(uploaded.file_url, imgEntry.blob);
              uploadedImages[i] = uploaded;
            } else {
              uploadedImages[i] = null;
            }
          }

          // 2. Build full artboard & slot payload matching MySQL schema
          const artboardsPayload: FotoweArtboardPayload[] = rawArtboards.map((b, abIdx) => {
            const rawSlots: any[] = Array.isArray(b.slots) ? b.slots : [];
            const mappedSlots: FotoweSlotPayload[] = rawSlots.map((q, slotIdx) => {
              const imgIdx = typeof q?.im === 'number' ? q.im : -1;
              const uploaded = imgIdx >= 0 ? uploadedImages[imgIdx] : null;
              if (uploaded) {
                return {
                  slot_index: slotIdx,
                  photo_id: uploaded.photo_id,
                  photo_url: uploaded.file_url,
                  thumb_url: uploaded.thumb_url,
                  name: uploaded.original_name,
                  file_size: uploaded.file_size,
                  z: typeof q.z === 'number' ? q.z : 1,
                  ox: typeof q.ox === 'number' ? q.ox : 0,
                  oy: typeof q.oy === 'number' ? q.oy : 0,
                  status: 'filled',
                };
              }
              return {
                slot_index: slotIdx,
                photo_id: null,
                photo_url: null,
                thumb_url: null,
                name: '',
                file_size: 0,
                z: 1,
                ox: 0,
                oy: 0,
                status: 'empty',
              };
            });

            return {
              id: String(b.id || `ab_${abIdx + 1}`),
              name: String(b.name || `Artboard ${abIdx + 1}`),
              t: String(b.t || '4R'),
              s: typeof b.s === 'number' ? b.s : 1,
              a: typeof b.a === 'number' ? b.a : 0,
              slots: mappedSlots,
            };
          });

          const created = await fotoweApi.createProject({
            id: projId,
            name: String(raw.name || 'Project Migrasi'),
            dpi: typeof raw.dpi === 'number' ? raw.dpi : 300,
            color: raw.color === 'gray' ? 'gray' : 'rgb',
            active: typeof raw.active === 'number' ? raw.active : 0,
            visibility: 'workspace',
            artboards: artboardsPayload,
          });

          // Confirm created on server before deleting IndexedDB record
          if (created && created.id) {
            await deleteEntryFromStore(db, entry.key);
            serverProjectIds.add(created.id);
            migratedCount++;
          } else {
            failedCount++;
          }
        } catch (migErr) {
          console.warn('[FOTOWE Migration] Ditunda, data lokal tetap aman:', migErr);
          failedCount++;
        }
      }
    } finally {
      db.close();
    }
  }

  return { migratedCount, failedCount };
}
