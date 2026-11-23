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
  photoUrl?: string | null;
  imageUrl?: string | null;
  image_url?: string | null;
  url?: string | null;
  src?: string | null;
  cors_url?: string | null;
  thumb_url?: string | null;
  name?: string;
  file_size?: number;
  z: number;
  ox: number;
  oy: number;
  zoom?: number;
  offset_x?: number;
  offset_y?: number;
  status: 'empty' | 'filled';
}

export interface FotoweArtboardPayload {
  id: string;
  name: string;
  t: string;
  template?: string;
  s: number;
  size_index?: number;
  a: number;
  active_slot?: number;
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
  url: string;
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

function parseArrayLike(input: unknown): any[] | null {
  if (Array.isArray(input)) return input;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function extractSlotUrl(q: any): string | null {
  if (!q || typeof q !== 'object') return null;
  const raw =
    q.photo_url ??
    q.photoUrl ??
    q.imageUrl ??
    q.image_url ??
    q.file_url ??
    q.url ??
    q.src ??
    q.thumb_url ??
    null;
  return normalizeAssetUrl(raw);
}

function extractArtboardsArray(raw: any, envelope?: any): any[] {
  const candidates = [
    envelope?.project?.artboards,
    envelope?.project?.pages,
    envelope?.data?.artboards,
    envelope?.data?.pages,
    raw?.artboards,
    raw?.pages,
    raw?.data?.artboards,
    raw?.data?.pages,
    envelope?.artboards,
    envelope?.pages,
  ];
  for (const cand of candidates) {
    const arr = parseArrayLike(cand);
    if (arr && arr.length > 0) return arr;
  }
  for (const cand of candidates) {
    const arr = parseArrayLike(cand);
    if (arr) return arr;
  }
  return [];
}

function countFilledSlotsInArtboards(artboardsArr: any[]): { count: number; hasSlotData: boolean } {
  let count = 0;
  let hasSlotData = false;
  for (const ab of artboardsArr) {
    const slots = parseArrayLike(ab?.slots);
    if (slots) {
      hasSlotData = true;
      for (const sl of slots) {
        if (!sl || typeof sl !== 'object') continue;
        const url = extractSlotUrl(sl);
        const hasPhotoId = sl.photo_id != null && Number(sl.photo_id) > 0;
        const hasFilledImg = Boolean(url || hasPhotoId);
        if (hasFilledImg && sl.status !== 'empty') {
          count++;
        }
      }
    }
  }
  return { count, hasSlotData };
}

function normalizeProjectSummary(raw: any): FotoweProjectSummary {
  const artboardsArr = extractArtboardsArray(raw);
  const { count: computedPhotos, hasSlotData } = countFilledSlotsInArtboards(artboardsArr);

  const serverPhotoCount = Number(raw?.photos ?? raw?.photo_count ?? raw?.filled_slots ?? 0);
  const normalizedServerCount = Number.isFinite(serverPhotoCount) && serverPhotoCount > 0 ? serverPhotoCount : 0;
  const finalPhotos = hasSlotData
    ? computedPhotos
    : normalizedServerCount > 0
    ? normalizedServerCount
    : computedPhotos;

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

  const rawName = String(raw?.name ?? raw?.title ?? '').trim();

  return {
    id: String(raw?.id ?? raw?.project_id ?? ''),
    name: rawName || 'Project Tanpa Nama',
    dpi: Number(raw?.dpi) > 0 ? Number(raw.dpi) : 300,
    color: raw?.color === 'gray' || raw?.color_mode === 'gray' ? 'gray' : 'rgb',
    active: typeof raw?.active === 'number' ? raw.active : Number(raw?.active_artboard ?? 0) || 0,
    n:
      artboardsArr.length > 0
        ? artboardsArr.length
        : typeof raw?.n === 'number' && raw.n > 0
        ? raw.n
        : Number(raw?.artboard_count ?? raw?.pages_count ?? 1) || 1,
    photos: finalPhotos,
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

function normalizeProjectDetail(raw: any, envelope?: any): FotoweProjectDetail {
  const summary = normalizeProjectSummary(raw);
  const rawArtboards = extractArtboardsArray(raw, envelope);

  const artboards: FotoweArtboardPayload[] = rawArtboards.map((b: any, abIdx: number) => {
    const rawSlots = parseArrayLike(b?.slots) || [];
    return {
      id: String(b?.id || `ab_${abIdx + 1}`),
      name: String(b?.name || `Artboard ${abIdx + 1}`),
      t: String(b?.t || b?.template || b?.template_code || '4R'),
      s: typeof b?.s === 'number' ? b.s : Number(b?.size_index ?? b?.photo_size_index ?? 1) || 1,
      a: typeof b?.a === 'number' ? b.a : Number(b?.active_slot ?? 0) || 0,
      thumbnail_url: normalizeAssetUrl(b?.thumbnail_url ?? null),
      slots: rawSlots.map((q: any, slotIdx: number) => {
        const resolvedUrl = extractSlotUrl(q);
        const resolvedPhotoId = q?.photo_id != null && Number(q.photo_id) > 0 ? Number(q.photo_id) : null;
        const resolvedCorsUrl = normalizeAssetUrl(q?.cors_url ?? null) ?? resolvedUrl;
        const resolvedThumbUrl = normalizeAssetUrl(q?.thumb_url ?? null) ?? resolvedUrl;
        const isFilled =
          q?.status === 'filled'
            ? Boolean(resolvedPhotoId || resolvedUrl)
            : Boolean((resolvedPhotoId || resolvedUrl) && q?.status !== 'empty');

        const zoomVal =
          typeof q?.z === 'number'
            ? q.z
            : typeof q?.zoom === 'number'
            ? q.zoom
            : Number(q?.z ?? q?.zoom ?? 1) || 1;
        const oxVal =
          typeof q?.ox === 'number'
            ? q.ox
            : typeof q?.offset_x === 'number'
            ? q.offset_x
            : Number(q?.ox ?? q?.offset_x ?? 0) || 0;
        const oyVal =
          typeof q?.oy === 'number'
            ? q.oy
            : typeof q?.offset_y === 'number'
            ? q.offset_y
            : Number(q?.oy ?? q?.offset_y ?? 0) || 0;

        return {
          slot_index: typeof q?.slot_index === 'number' ? q.slot_index : Number(q?.slot_index ?? slotIdx),
          photo_id: resolvedPhotoId,
          photo_url: resolvedUrl,
          photoUrl: resolvedUrl,
          imageUrl: resolvedUrl,
          image_url: resolvedUrl,
          url: resolvedUrl,
          src: resolvedUrl,
          cors_url: resolvedCorsUrl,
          thumb_url: resolvedThumbUrl,
          name: typeof q?.name === 'string' ? q.name : typeof q?.photo_name === 'string' ? q.photo_name : '',
          file_size: Number(q?.file_size ?? 0) || 0,
          z: zoomVal,
          ox: oxVal,
          oy: oyVal,
          status: isFilled ? 'filled' : 'empty',
        };
      }),
    };
  });

  const permissionsRaw =
    parseArrayLike(raw?.permissions) ||
    parseArrayLike(envelope?.project?.permissions) ||
    parseArrayLike(envelope?.data?.permissions) ||
    [];
  const permissions: FotowePermissionEntry[] = permissionsRaw;

  const { count: detailPhotoCount } = countFilledSlotsInArtboards(artboards);

  return {
    ...summary,
    n: artboards.length > 0 ? artboards.length : summary.n,
    photos: detailPhotoCount,
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
  explicit_save?: boolean;
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
  explicit_save?: boolean;
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

    let candidate: any = json?.project ?? json?.data?.project ?? json?.data ?? json;
    if (Array.isArray(candidate)) {
      candidate =
        candidate.find((item) => String(item?.id ?? item?.project_id) === String(projectId)) ??
        candidate[0];
    }
    if (!candidate || typeof candidate !== 'object') {
      throw new Error('Detail project tidak ditemukan di server.');
    }

    return normalizeProjectDetail(candidate, json);
  },

  async saveProject(payload: FotoweSaveProjectPayload): Promise<FotoweProjectSummary> {
    const { isRemotePersisted, isOwner, ...restPayload } = payload;
    const wirePayload = {
      ...restPayload,
      explicit_save: payload.explicit_save ?? true,
    };
    const bodyStr = JSON.stringify(wirePayload);

    const extractSavedRaw = (json: any) => {
      const inner = json?.project ?? json?.data ?? {};
      const resolvedId =
        inner?.id ??
        inner?.project_id ??
        json?.id ??
        json?.project_id ??
        wirePayload.id;
      return {
        ...wirePayload,
        ...(typeof inner === 'object' && inner ? inner : {}),
        id: resolvedId,
      };
    };

    try {
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
        return normalizeProjectSummary(extractSavedRaw(updated.json));
      }

      return normalizeProjectSummary(extractSavedRaw(json));
    } catch (err: any) {
      // If a shared collaborator (non-owner) edits an existing server project and create.php rejects, retry via update.php
      if (isRemotePersisted && isOwner === false && wirePayload.id && wirePayload.id !== 0) {
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
        return normalizeProjectSummary(extractSavedRaw(json));
      }
      throw err;
    }
  },

  async updatePermissions(payload: FotoweUpdatePermissionsPayload): Promise<FotoweProjectSummary> {
    const bodyStr = JSON.stringify({
      ...payload,
      explicit_save: payload.explicit_save ?? true,
    });
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

    const raw = json?.project ?? json?.data ?? payload;
    return normalizeProjectSummary(raw);
  },

  async createProject(payload: {
    id?: string | number;
    name: string;
    explicit_save?: boolean;
    dpi: number;
    color: 'rgb' | 'gray';
    active: number;
    thumbnail_data?: string | null;
    thumbnail_url?: string | null;
    visibility?: 'workspace' | 'private';
    artboards: FotoweArtboardPayload[];
    pages?: FotoweArtboardPayload[];
    permissions?: FotowePermissionEntry[];
  }): Promise<FotoweProjectSummary> {
    const bodyStr = JSON.stringify({
      ...payload,
      explicit_save: payload.explicit_save ?? true,
      pages: payload.pages ?? payload.artboards,
    });
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

    const inner = json?.project ?? json?.data ?? {};
    const resolvedId = inner?.id ?? inner?.project_id ?? json?.id ?? payload.id;
    return normalizeProjectSummary({ ...payload, ...(typeof inner === 'object' && inner ? inner : {}), id: resolvedId });
  },

  async updateProject(payload: {
    id: string;
    name?: string;
    explicit_save?: boolean;
    dpi?: number;
    color?: 'rgb' | 'gray';
    active?: number;
    thumbnail_data?: string | null;
    thumbnail_url?: string | null;
    visibility?: 'workspace' | 'private';
    shared_editors?: Array<string | number>;
    artboards?: FotoweArtboardPayload[];
    pages?: FotoweArtboardPayload[];
    permissions?: FotowePermissionEntry[];
  }): Promise<FotoweProjectSummary> {
    const bodyStr = JSON.stringify({
      ...payload,
      explicit_save: payload.explicit_save ?? true,
    });
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

    const raw = json?.project ?? json?.data ?? payload;
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
    const fileUrl =
      normalizeAssetUrl(
        raw.url ?? raw.file_url ?? raw.photo_url ?? raw.image_url ?? raw.src ?? json?.url
      ) || '';
    const corsUrl = normalizeAssetUrl(raw.cors_url ?? fileUrl) || fileUrl;
    const thumbUrl = normalizeAssetUrl(raw.thumb_url ?? fileUrl) || fileUrl;

    if (!fileUrl && !(Number(raw.photo_id ?? raw.id ?? 0) > 0)) {
      throw new Error('Server tidak mengembalikan URL foto yang valid.');
    }

    return {
      photo_id: Number(raw.photo_id ?? raw.id ?? 0) || 0,
      photo_key: String(raw.photo_key ?? ''),
      original_name: String(raw.original_name ?? raw.name ?? cleanName),
      file_url: fileUrl,
      url: fileUrl,
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
