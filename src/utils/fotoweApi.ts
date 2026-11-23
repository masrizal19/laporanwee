import { buildApiUrl } from './api';
import {
  fetchWithTimeout,
  DEFAULT_REQUEST_TIMEOUT_MS,
  UPLOAD_REQUEST_TIMEOUT_MS,
} from './apiCache';

const FOTOWE_API_BASE = 'https://api-laporanwe.mkverse.my.id/api/fotowe';

export const getActiveToken = (): string => {
  try {
    const raw =
      localStorage.getItem('token') ||
      localStorage.getItem('auth_token') ||
      sessionStorage.getItem('token') ||
      sessionStorage.getItem('auth_token') ||
      localStorage.getItem('laporanwee_token') ||
      sessionStorage.getItem('laporanwee_token') ||
      '';
    const clean = raw.trim();
    if (!clean || clean === 'undefined' || clean === 'null' || clean === 'session-active-token') {
      return '';
    }
    return clean;
  } catch {
    return '';
  }
};

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
  const token = getActiveToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...extra,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function formatFotoweError(err: unknown, fallbackMessage: string): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
      ? err
      : '';
  const trimmed = raw.trim();
  if (
    !trimmed ||
    /failed to fetch|load failed|networkerror|network request failed|fetch failed|the internet connection appears to be offline|aborted/i.test(
      trimmed
    )
  ) {
    return fallbackMessage;
  }
  return trimmed;
}

function normalizeAssetUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const clean = rawUrl.trim();
  if (!clean) return null;
  if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:') || clean.startsWith('blob:')) {
    return clean;
  }
  return `https://api-laporanwe.mkverse.my.id/${clean.replace(/^\/+/, '')}`;
}

function normalizeProjectSummary(raw: any): FotoweProjectSummary {
  const artboardsArr = Array.isArray(raw?.artboards) ? raw.artboards : [];
  let computedPhotos = 0;
  if (artboardsArr.length > 0) {
    for (const ab of artboardsArr) {
      if (Array.isArray(ab?.slots)) {
        for (const sl of ab.slots) {
          if (sl && (sl.status === 'filled' || sl.photo_id || sl.photo_url)) {
            computedPhotos++;
          }
        }
      }
    }
  }
  const savedRaw = raw?.saved ?? raw?.updated_at ?? raw?.created_at;
  let savedTs = Date.now();
  if (typeof savedRaw === 'number' && Number.isFinite(savedRaw)) {
    savedTs = savedRaw > 1e12 ? savedRaw : savedRaw * 1000;
  } else if (typeof savedRaw === 'string' && savedRaw.trim()) {
    const parsed = Date.parse(savedRaw);
    if (!Number.isNaN(parsed)) savedTs = parsed;
  }

  const isOwner = raw?.is_owner !== undefined ? Boolean(raw.is_owner) : true;
  const isAdmin = Boolean(raw?.is_admin);
  const canEdit = raw?.can_edit !== undefined ? Boolean(raw.can_edit) : isOwner || isAdmin;
  const canDelete = raw?.can_delete !== undefined ? Boolean(raw.can_delete) : isOwner || isAdmin;
  const canManagePermissions =
    raw?.can_manage_permissions !== undefined ? Boolean(raw.can_manage_permissions) : isOwner || isAdmin;
  const accessRole: FotoweProjectSummary['access_role'] =
    raw?.access_role || (isAdmin ? 'admin' : isOwner ? 'owner' : canEdit ? 'editor' : 'viewer');

  return {
    id: String(raw?.id ?? raw?.project_id ?? ''),
    name: String(raw?.name ?? raw?.title ?? 'Project Tanpa Nama'),
    dpi: Number(raw?.dpi) > 0 ? Number(raw.dpi) : 300,
    color: raw?.color === 'gray' || raw?.color_mode === 'gray' ? 'gray' : 'rgb',
    active: typeof raw?.active === 'number' ? raw.active : Number(raw?.active_artboard ?? 0) || 0,
    n: typeof raw?.n === 'number' ? raw.n : artboardsArr.length || Number(raw?.artboard_count ?? 1) || 1,
    photos: typeof raw?.photos === 'number' ? raw.photos : Number(raw?.photo_count ?? computedPhotos) || computedPhotos,
    thumbnail_url: normalizeAssetUrl(raw?.thumbnail_url ?? raw?.thumbnail ?? null),
    visibility: raw?.visibility === 'private' ? 'private' : 'workspace',
    version: typeof raw?.version === 'number' ? raw.version : 1,
    owner_user_id: Number(raw?.owner_user_id ?? raw?.user_id ?? 0) || 0,
    owner_name: String(raw?.owner_name ?? raw?.user_name ?? 'Anda'),
    owner_email: String(raw?.owner_email ?? raw?.user_email ?? ''),
    is_owner: isOwner,
    is_admin: isAdmin,
    can_edit: canEdit,
    can_delete: canDelete,
    can_manage_permissions: canManagePermissions,
    access_role: accessRole,
    saved: savedTs,
    updated_at: typeof raw?.updated_at === 'string' ? raw.updated_at : undefined,
  };
}

function normalizeProjectDetail(raw: any): FotoweProjectDetail {
  const summary = normalizeProjectSummary(raw);
  const rawArtboards = Array.isArray(raw?.artboards)
    ? raw.artboards
    : Array.isArray(raw?.data?.artboards)
    ? raw.data.artboards
    : [];

  const artboards: FotoweArtboardPayload[] = rawArtboards.map((b: any, abIdx: number) => ({
    id: String(b?.id || `ab_${abIdx + 1}`),
    name: String(b?.name || `Artboard ${abIdx + 1}`),
    t: String(b?.t || b?.template || '4R'),
    s: typeof b?.s === 'number' ? b.s : Number(b?.size_index ?? 1) || 1,
    a: typeof b?.a === 'number' ? b.a : Number(b?.active_slot ?? 0) || 0,
    thumbnail_url: normalizeAssetUrl(b?.thumbnail_url ?? null),
    slots: Array.isArray(b?.slots)
      ? b.slots.map((q: any, slotIdx: number) => ({
          slot_index: typeof q?.slot_index === 'number' ? q.slot_index : slotIdx,
          photo_id: q?.photo_id != null ? Number(q.photo_id) : null,
          photo_url: normalizeAssetUrl(q?.photo_url ?? q?.file_url ?? null),
          cors_url: normalizeAssetUrl(q?.cors_url ?? null),
          thumb_url: normalizeAssetUrl(q?.thumb_url ?? q?.photo_url ?? null),
          name: typeof q?.name === 'string' ? q.name : '',
          file_size: Number(q?.file_size ?? 0) || 0,
          z: typeof q?.z === 'number' ? q.z : 1,
          ox: typeof q?.ox === 'number' ? q.ox : 0,
          oy: typeof q?.oy === 'number' ? q.oy : 0,
          status:
            q?.status === 'filled' || q?.photo_id || q?.photo_url
              ? 'filled'
              : 'empty',
        }))
      : [],
  }));

  const permissions: FotowePermissionEntry[] = Array.isArray(raw?.permissions)
    ? raw.permissions
    : [];

  return {
    ...summary,
    artboards,
    permissions,
  };
}

interface ParsedFallbackResult {
  res: Response;
  json: any;
}

async function fetchJsonWithFallback(
  urls: string[],
  initFactory: () => RequestInit,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<ParsedFallbackResult> {
  let lastError: (Error & { status?: number }) | null = null;

  for (let idx = 0; idx < urls.length; idx++) {
    const url = urls[idx];
    const hasNext = idx < urls.length - 1;

    try {
      const res = await fetchWithTimeout(url, initFactory(), timeoutMs);
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      // If endpoint path doesn't exist (404/405) or returned non-JSON error page, try fallback path
      if (hasNext && (res.status === 404 || res.status === 405 || (!res.ok && json === null))) {
        lastError = Object.assign(
          new Error((json && json.message) || `Endpoint FOTOWE merespons HTTP ${res.status}.`),
          { status: res.status }
        );
        continue;
      }

      if (!res.ok) {
        const err = Object.assign(
          new Error(
            (json && typeof json.message === 'string' && json.message.trim()) ||
              (res.status === 401
                ? 'Sesi akun Anda telah berakhir. Silakan masuk kembali.'
                : res.status === 403
                ? 'Anda tidak memiliki izin untuk melakukan tindakan ini.'
                : `Server FOTOWE merespons HTTP ${res.status}.`)
          ),
          { status: res.status }
        );
        throw err;
      }

      if (json && json.success === false) {
        const err = Object.assign(
          new Error(
            (typeof json.message === 'string' && json.message.trim()) ||
              'Permintaan ke server FOTOWE gagal.'
          ),
          { status: res.status }
        );
        throw err;
      }

      // Guard against unexpected HTML 200 fallback pages when another API path exists
      if (json === null && text.trim().startsWith('<') && hasNext) {
        lastError = new Error('Respons server FOTOWE tidak valid.');
        continue;
      }

      return { res, json };
    } catch (err: any) {
      const isHttpAppError = typeof err?.status === 'number' && err.status !== 404 && err.status !== 405;
      if (isHttpAppError) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error('Tidak dapat terhubung ke server FOTOWE.');
      if (!hasNext) {
        throw new Error(
          formatFotoweError(
            lastError,
            'Tidak dapat terhubung ke server FOTOWE. Periksa koneksi internet Anda lalu coba lagi.'
          )
        );
      }
    }
  }

  throw new Error(
    formatFotoweError(
      lastError,
      'Tidak dapat terhubung ke server FOTOWE. Periksa koneksi internet Anda lalu coba lagi.'
    )
  );
}

export interface FotoweSaveProjectPayload {
  id: string | number;
  name: string;
  W: number;
  H: number;
  dpi: number;
  unit: string;
  bg: string;
  visibility: 'workspace' | 'private';
  shared_editors: Array<string | number>;
  pp: Record<string, any>;
  pages: FotoweArtboardPayload[];
  thumbnail: string | null;
  color: 'rgb' | 'gray';
  active: number;
  thumbnail_data?: string | null;
  thumbnail_url?: string | null;
  artboards: FotoweArtboardPayload[];
  permissions?: FotowePermissionEntry[];
  isRemotePersisted?: boolean;
  isOwner?: boolean;
}

export interface FotoweUpdatePermissionsPayload {
  id: string | number;
  name: string;
  visibility: 'workspace' | 'private';
  shared_editors: Array<string | number>;
  permissions?: FotowePermissionEntry[];
}

export const fotoweApi = {
  async listProjects(): Promise<FotoweProjectSummary[]> {
    const { json } = await fetchJsonWithFallback(
      [
        `${FOTOWE_API_BASE}/projects/read.php`,
        `${FOTOWE_API_BASE}/read.php`,
      ],
      () => ({
        method: 'GET',
        cache: 'no-store',
        headers: authHeaders(),
      })
    );

    const rawList = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.projects)
      ? json.projects
      : Array.isArray(json?.items)
      ? json.items
      : [];

    return rawList.map(normalizeProjectSummary).filter((p: FotoweProjectSummary) => Boolean(p.id));
  },

  async getProjectDetail(projectId: string): Promise<FotoweProjectDetail> {
    const encodedId = encodeURIComponent(projectId);
    const { json } = await fetchJsonWithFallback(
      [
        `${FOTOWE_API_BASE}/projects/detail.php?id=${encodedId}`,
        `${FOTOWE_API_BASE}/projects/read.php?id=${encodedId}`,
        `${FOTOWE_API_BASE}/read.php?id=${encodedId}`,
        `${FOTOWE_API_BASE}/detail.php?id=${encodedId}`,
      ],
      () => ({
        method: 'GET',
        cache: 'no-store',
        headers: authHeaders(),
      })
    );

    let candidate: any = json?.data ?? json?.project ?? json;
    if (Array.isArray(candidate)) {
      candidate =
        candidate.find((item) => String(item?.id ?? item?.project_id) === String(projectId)) ??
        candidate[0];
    }
    if (!candidate || typeof candidate !== 'object') {
      throw new Error('Detail project tidak ditemukan di server.');
    }

    return normalizeProjectDetail(candidate);
  },

  async saveProject(payload: FotoweSaveProjectPayload): Promise<FotoweProjectSummary> {
    const { isRemotePersisted, isOwner, ...wirePayload } = payload;
    const bodyStr = JSON.stringify(wirePayload);

    // If a shared collaborator (non-owner) edits an existing server project, update in place via update.php
    if (isRemotePersisted && isOwner === false && wirePayload.id && wirePayload.id !== 0) {
      const { json } = await fetchJsonWithFallback(
        [
          `${FOTOWE_API_BASE}/projects/update.php`,
          `${FOTOWE_API_BASE}/update.php`,
          `${FOTOWE_API_BASE}/projects/create.php`,
          `${FOTOWE_API_BASE}/create.php`,
        ],
        () => ({
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: bodyStr,
        })
      );
      const raw = json?.data ?? json?.project ?? wirePayload;
      return normalizeProjectSummary(raw);
    }

    const { json } = await fetchJsonWithFallback(
      [
        `${FOTOWE_API_BASE}/projects/create.php`,
        `${FOTOWE_API_BASE}/create.php`,
      ],
      () => ({
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: bodyStr,
      })
    );

    // If backend create.php reports project already exists without upserting, apply changes via update.php
    if (json?.data?.already_exists === true && (json?.data?.id || wirePayload.id)) {
      const targetId = json.data.id ?? wirePayload.id;
      const updateBody = JSON.stringify({ ...wirePayload, id: targetId });
      const updated = await fetchJsonWithFallback(
        [
          `${FOTOWE_API_BASE}/projects/update.php`,
          `${FOTOWE_API_BASE}/update.php`,
        ],
        () => ({
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: updateBody,
        })
      );
      const rawUpdated = updated.json?.data ?? updated.json?.project ?? { ...wirePayload, id: targetId };
      return normalizeProjectSummary(rawUpdated);
    }

    const raw = json?.data ?? json?.project ?? { ...wirePayload, id: json?.id ?? wirePayload.id };
    return normalizeProjectSummary(raw);
  },

  async updatePermissions(payload: FotoweUpdatePermissionsPayload): Promise<FotoweProjectSummary> {
    const bodyStr = JSON.stringify(payload);
    const { json } = await fetchJsonWithFallback(
      [
        `${FOTOWE_API_BASE}/projects/update.php`,
        `${FOTOWE_API_BASE}/update.php`,
      ],
      () => ({
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: bodyStr,
      })
    );

    const raw = json?.data ?? json?.project ?? payload;
    return normalizeProjectSummary(raw);
  },

  async createProject(payload: {
    id?: string | number;
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
    const bodyStr = JSON.stringify(payload);
    const { json } = await fetchJsonWithFallback(
      [
        `${FOTOWE_API_BASE}/projects/create.php`,
        `${FOTOWE_API_BASE}/create.php`,
      ],
      () => ({
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: bodyStr,
      })
    );

    const raw = json?.data ?? json?.project ?? { ...payload, id: json?.id ?? payload.id };
    return normalizeProjectSummary(raw);
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
    shared_editors?: Array<string | number>;
    artboards?: FotoweArtboardPayload[];
    permissions?: FotowePermissionEntry[];
  }): Promise<FotoweProjectSummary> {
    const bodyStr = JSON.stringify(payload);
    const { json } = await fetchJsonWithFallback(
      [
        `${FOTOWE_API_BASE}/projects/update.php`,
        `${FOTOWE_API_BASE}/projects/create.php`,
        `${FOTOWE_API_BASE}/update.php`,
        `${FOTOWE_API_BASE}/create.php`,
      ],
      () => ({
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: bodyStr,
      })
    );

    const raw = json?.data ?? json?.project ?? payload;
    return normalizeProjectSummary(raw);
  },

  async deleteProject(projectId: string): Promise<void> {
    const bodyStr = JSON.stringify({ id: projectId, project_id: projectId });
    await fetchJsonWithFallback(
      [
        `${FOTOWE_API_BASE}/projects/delete.php`,
        `${FOTOWE_API_BASE}/delete.php`,
      ],
      () => ({
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: bodyStr,
      })
    );
  },

  async uploadPhoto(blob: Blob, fileName: string): Promise<UploadedFotowePhoto> {
    const cleanName = fileName && fileName.trim() ? fileName.trim() : 'foto.jpg';
    const { json } = await fetchJsonWithFallback(
      [
        `${FOTOWE_API_BASE}/projects/upload.php`,
        `${FOTOWE_API_BASE}/upload.php`,
      ],
      () => {
        const formData = new FormData();
        formData.append('photo', blob, cleanName);
        return {
          method: 'POST',
          headers: authHeaders(),
          body: formData,
        };
      },
      UPLOAD_REQUEST_TIMEOUT_MS
    );

    const raw = json?.data ?? json?.photo ?? json ?? {};
    const fileUrl = normalizeAssetUrl(raw.file_url ?? raw.photo_url ?? raw.url) || '';
    const corsUrl = normalizeAssetUrl(raw.cors_url ?? fileUrl) || fileUrl;
    const thumbUrl = normalizeAssetUrl(raw.thumb_url ?? fileUrl) || fileUrl;

    return {
      photo_id: Number(raw.photo_id ?? raw.id ?? 0) || 0,
      photo_key: String(raw.photo_key ?? ''),
      original_name: String(raw.original_name ?? raw.name ?? cleanName),
      file_url: fileUrl,
      cors_url: corsUrl,
      thumb_url: thumbUrl,
      thumb_cors_url: normalizeAssetUrl(raw.thumb_cors_url) || undefined,
      mime_type: String(raw.mime_type ?? blob.type ?? 'image/jpeg'),
      file_size: Number(raw.file_size ?? blob.size) || blob.size,
      width: Number(raw.width ?? 0) || 0,
      height: Number(raw.height ?? 0) || 0,
    };
  },

  async deletePhoto(photoId: number): Promise<void> {
    const bodyStr = JSON.stringify({ photo_id: photoId, id: photoId });
    await fetchJsonWithFallback(
      [
        `${FOTOWE_API_BASE}/delete.php`,
        `${FOTOWE_API_BASE}/projects/delete.php`,
      ],
      () => ({
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: bodyStr,
      })
    );
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

  const token = getActiveToken();

  for (const url of candidates) {
    const cached = remoteBlobCache.get(url);
    if (cached) return cached;

    try {
      const isApiProxy = url.includes('/api/fotowe/');
      const res = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'force-cache',
        headers: isApiProxy && token ? { Authorization: `Bearer ${token}` } : undefined,
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
