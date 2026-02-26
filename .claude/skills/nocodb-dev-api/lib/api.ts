import { refreshToken } from './credentials.js';
import type {
  SigninResponse,
  UserResponse,
  Workspace,
  WorkspaceUser,
  Base,
  Table,
  Column,
  View,
  RecordList,
  CountResponse,
} from './types.js';

// ---------------------------------------------------------------------------
// Core HTTP helper
// ---------------------------------------------------------------------------

interface RequestOptions {
  url: string;
  method?: string;
  token?: string;
  email?: string;      // for 401 auto-retry: which user to refresh
  body?: unknown;
  params?: Record<string, string | number | string[] | undefined>;
}

export async function request<T = unknown>(
  path: string,
  opts: RequestOptions,
): Promise<T> {
  const { url: baseUrl, method = 'GET', token, email, body, params } = opts;
  const base = baseUrl.replace(/\/+$/, '');

  let fullUrl = `${base}${path}`;
  if (params) {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) {
        for (const item of v) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`);
      } else {
        parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
      }
    }
    if (parts.length) fullUrl += `?${parts.join('&')}`;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['xc-auth'] = token;

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  // Auto-retry on 401: refresh the token and replay the request once
  if (res.status === 401 && token && email) {
    const newToken = await refreshToken(baseUrl, email);
    const retryHeaders = { ...headers, 'xc-auth': newToken };
    const retry = await fetch(fullUrl, {
      method,
      headers: retryHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const retryText = await retry.text();
    let retryData: unknown;
    try { retryData = JSON.parse(retryText); } catch { retryData = retryText; }
    if (!retry.ok) {
      const retryMsg =
        typeof retryData === 'object' && retryData && 'msg' in retryData
          ? (retryData as { msg: string }).msg
          : typeof retryData === 'string' ? retryData : retry.statusText;
      throw new Error(`${retry.status} ${retryMsg}`);
    }
    return retryData as T;
  }

  if (!res.ok) {
    const msg =
      typeof data === 'object' && data && 'msg' in data
        ? (data as { msg: string }).msg
        : typeof data === 'string'
          ? data
          : res.statusText;
    throw new Error(`${res.status} ${msg}`);
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Auth (v1 — no v3 prefix for auth)
// ---------------------------------------------------------------------------

export async function signin(url: string, email: string, password: string): Promise<SigninResponse> {
  return request('/api/v1/auth/user/signin', { url, method: 'POST', body: { email, password } });
}

export async function signup(url: string, email: string, password: string): Promise<SigninResponse> {
  return request('/api/v1/auth/user/signup', { url, method: 'POST', body: { email, password } });
}

export async function me(url: string, token: string, email?: string): Promise<UserResponse> {
  return request('/api/v1/auth/user/me', { url, token, email });
}

// ---------------------------------------------------------------------------
// Health / Version (v1)
// ---------------------------------------------------------------------------

export async function health(url: string): Promise<unknown> {
  return request('/api/v1/health', { url });
}

export async function version(url: string): Promise<unknown> {
  return request('/api/v1/version', { url });
}

// ---------------------------------------------------------------------------
// Workspaces (v3)
// ---------------------------------------------------------------------------

export async function listWorkspaces(url: string, token: string, email?: string): Promise<{ list: Workspace[] }> {
  return request('/api/v3/meta/workspaces', { url, token, email });
}

export async function createWorkspace(url: string, token: string, title: string, email?: string): Promise<Workspace> {
  return request('/api/v3/meta/workspaces', { url, method: 'POST', token, email, body: { title } });
}

export async function getWorkspace(url: string, token: string, id: string, email?: string): Promise<Workspace> {
  return request(`/api/v3/meta/workspaces/${id}`, { url, token, email });
}

export async function updateWorkspace(url: string, token: string, id: string, data: Record<string, unknown>, email?: string): Promise<unknown> {
  return request(`/api/v3/meta/workspaces/${id}`, { url, method: 'PATCH', token, email, body: data });
}

export async function deleteWorkspace(url: string, token: string, id: string, email?: string): Promise<unknown> {
  return request(`/api/v3/meta/workspaces/${id}`, { url, method: 'DELETE', token, email });
}

// ---------------------------------------------------------------------------
// Workspace Users (v1 for list, v3 for invite)
// ---------------------------------------------------------------------------

export async function listWorkspaceUsers(
  url: string,
  token: string,
  wsId: string,
  email?: string,
): Promise<{ list: WorkspaceUser[] }> {
  return request(`/api/v1/workspaces/${wsId}/users`, { url, token, email });
}

/** Invite user to workspace. Uses v1 (v3 requires feature_api_member_management, EE only). */
export async function inviteToWorkspace(
  url: string,
  token: string,
  wsId: string,
  inviteEmail: string,
  role: string,
  email?: string,
): Promise<unknown> {
  return request(`/api/v1/workspaces/${wsId}/invitations`, {
    url,
    method: 'POST',
    token,
    email,
    body: { email: inviteEmail, roles: role },
  });
}

/** Update workspace member role. Uses v1. */
export async function updateWorkspaceMember(
  url: string,
  token: string,
  wsId: string,
  userId: string,
  role: string,
  email?: string,
): Promise<unknown> {
  return request(`/api/v1/workspaces/${wsId}/users/${userId}`, {
    url,
    method: 'PATCH',
    token,
    email,
    body: { roles: role },
  });
}

/** Remove workspace member. Uses v1. */
export async function removeWorkspaceMember(
  url: string,
  token: string,
  wsId: string,
  userId: string,
  email?: string,
): Promise<unknown> {
  return request(`/api/v1/workspaces/${wsId}/users/${userId}`, {
    url,
    method: 'DELETE',
    token,
    email,
  });
}

// ---------------------------------------------------------------------------
// Bases (v3)
// ---------------------------------------------------------------------------

export async function listBases(url: string, token: string, wsId: string, email?: string): Promise<{ list: Base[] }> {
  return request(`/api/v3/meta/workspaces/${wsId}/bases`, { url, token, email });
}

export async function createBase(url: string, token: string, wsId: string, title: string, email?: string): Promise<Base> {
  return request(`/api/v3/meta/workspaces/${wsId}/bases`, {
    url,
    method: 'POST',
    token,
    email,
    body: { title },
  });
}

export async function getBase(url: string, token: string, baseId: string, email?: string): Promise<Base> {
  return request(`/api/v3/meta/bases/${baseId}`, { url, token, email });
}

export async function updateBase(
  url: string,
  token: string,
  baseId: string,
  data: Record<string, unknown>,
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}`, { url, method: 'PATCH', token, email, body: data });
}

export async function deleteBase(url: string, token: string, baseId: string, email?: string): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}`, { url, method: 'DELETE', token, email });
}

// ---------------------------------------------------------------------------
// Base Members (v3 — EE)
// ---------------------------------------------------------------------------

export async function inviteBaseMember(
  url: string,
  token: string,
  baseId: string,
  inviteEmail: string,
  role: string,
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/members`, {
    url,
    method: 'POST',
    token,
    email,
    body: [{ email: inviteEmail, base_role: role }],
  });
}

export async function updateBaseMember(
  url: string,
  token: string,
  baseId: string,
  userId: string,
  role: string,
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/members`, {
    url,
    method: 'PATCH',
    token,
    email,
    body: { user_id: userId, base_role: role },
  });
}

export async function removeBaseMember(
  url: string,
  token: string,
  baseId: string,
  userId: string,
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/members`, {
    url,
    method: 'DELETE',
    token,
    email,
    body: { user_id: userId },
  });
}

// ---------------------------------------------------------------------------
// Tables (v3)
// ---------------------------------------------------------------------------

export async function listTables(url: string, token: string, baseId: string, email?: string): Promise<{ list: Table[] }> {
  return request(`/api/v3/meta/bases/${baseId}/tables`, { url, token, email });
}

export async function createTable(
  url: string,
  token: string,
  baseId: string,
  title: string,
  fields: Array<{ title: string; type: string; [k: string]: unknown }>,
  email?: string,
): Promise<Table> {
  return request(`/api/v3/meta/bases/${baseId}/tables`, {
    url,
    method: 'POST',
    token,
    email,
    body: { title, fields },
  });
}

export async function getTable(url: string, token: string, baseId: string, tableId: string, email?: string): Promise<Table> {
  return request(`/api/v3/meta/bases/${baseId}/tables/${tableId}`, { url, token, email });
}

export async function updateTable(
  url: string,
  token: string,
  baseId: string,
  tableId: string,
  data: Record<string, unknown>,
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/tables/${tableId}`, {
    url,
    method: 'PATCH',
    token,
    email,
    body: data,
  });
}

export async function deleteTable(url: string, token: string, baseId: string, tableId: string, email?: string): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/tables/${tableId}`, { url, method: 'DELETE', token, email });
}

// ---------------------------------------------------------------------------
// Fields / Columns (v3)
// ---------------------------------------------------------------------------

export async function listFields(url: string, token: string, baseId: string, tableId: string, email?: string): Promise<Column[]> {
  const table = await getTable(url, token, baseId, tableId, email);
  return table.fields || table.columns || [];
}

export async function getField(url: string, token: string, baseId: string, fieldId: string, email?: string): Promise<Column> {
  return request(`/api/v3/meta/bases/${baseId}/fields/${fieldId}`, { url, token, email });
}

export async function createField(
  url: string,
  token: string,
  baseId: string,
  tableId: string,
  field: { title: string; type: string; [k: string]: unknown },
  email?: string,
): Promise<Column> {
  return request(`/api/v3/meta/bases/${baseId}/tables/${tableId}/fields`, {
    url,
    method: 'POST',
    token,
    email,
    body: field,
  });
}

export async function updateField(
  url: string,
  token: string,
  baseId: string,
  fieldId: string,
  field: Record<string, unknown>,
  email?: string,
): Promise<Column> {
  return request(`/api/v3/meta/bases/${baseId}/fields/${fieldId}`, {
    url,
    method: 'PATCH',
    token,
    email,
    body: field,
  });
}

export async function deleteField(url: string, token: string, baseId: string, fieldId: string, email?: string): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/fields/${fieldId}`, { url, method: 'DELETE', token, email });
}

// ---------------------------------------------------------------------------
// Views (internal — v3 requires feature_api_view_v3, EE only)
// ---------------------------------------------------------------------------

const VALID_VIEW_TYPES = ['grid', 'form', 'gallery', 'kanban', 'calendar', 'map'];

/** Map generic view types to internal create operation names */
const VIEW_CREATE_OPS: Record<string, string> = {
  grid: 'gridViewCreate', form: 'formViewCreate', gallery: 'galleryViewCreate',
  kanban: 'kanbanViewCreate', map: 'mapViewCreate', calendar: 'calendarViewCreate',
};

export async function listViews(
  url: string,
  token: string,
  wsId: string,
  baseId: string,
  tableId: string,
  email?: string,
): Promise<{ list: View[] }> {
  return iGet(url, token, wsId, baseId, 'viewList', { tableId }, email) as Promise<{ list: View[] }>;
}

export async function createView(
  url: string,
  token: string,
  wsId: string,
  baseId: string,
  tableId: string,
  title: string,
  type: string = 'grid',
  email?: string,
): Promise<View> {
  if (!VALID_VIEW_TYPES.includes(type)) {
    throw new Error(`Unknown view type: ${type}. Use: ${VALID_VIEW_TYPES.join(', ')}`);
  }
  const op = VIEW_CREATE_OPS[type];
  return iPost(url, token, wsId, baseId, op, { title }, { tableId }, email) as Promise<View>;
}

export async function getView(
  url: string,
  token: string,
  wsId: string,
  baseId: string,
  tableId: string,
  viewId: string,
  email?: string,
): Promise<View> {
  const { list } = await listViews(url, token, wsId, baseId, tableId, email);
  const view = list.find((v) => v.id === viewId);
  if (!view) throw new Error(`View ${viewId} not found in table ${tableId}`);
  return view;
}

export async function updateView(
  url: string,
  token: string,
  wsId: string,
  baseId: string,
  viewId: string,
  data: Record<string, unknown>,
  email?: string,
): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'viewUpdate', { view: data }, { viewId }, email);
}

export async function deleteView(url: string, token: string, wsId: string, baseId: string, viewId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'viewDelete', {}, { viewId }, email);
}

// ---------------------------------------------------------------------------
// View Columns (internal)
// ---------------------------------------------------------------------------

export async function listViewColumns(url: string, token: string, wsId: string, baseId: string, viewId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'viewColumnList', { viewId }, email);
}

export async function updateViewColumns(
  url: string,
  token: string,
  wsId: string,
  baseId: string,
  viewId: string,
  columnId: string,
  data: unknown,
  email?: string,
): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'viewColumnUpdate', { column: data }, { viewId, columnId }, email);
}

// ---------------------------------------------------------------------------
// Filters (v3)
// ---------------------------------------------------------------------------

export async function listFilters(
  url: string,
  token: string,
  baseId: string,
  viewId: string,
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/views/${viewId}/filters`, { url, token, email });
}

export async function createFilter(
  url: string,
  token: string,
  baseId: string,
  viewId: string,
  filter: unknown,
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/views/${viewId}/filters`, {
    url,
    method: 'POST',
    token,
    email,
    body: filter,
  });
}

export async function updateFilter(
  url: string,
  token: string,
  baseId: string,
  viewId: string,
  filter: unknown,
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/views/${viewId}/filters`, {
    url,
    method: 'PATCH',
    token,
    email,
    body: filter,
  });
}

export async function replaceFilters(
  url: string,
  token: string,
  baseId: string,
  viewId: string,
  filters: unknown,
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/views/${viewId}/filters`, {
    url,
    method: 'PUT',
    token,
    email,
    body: filters,
  });
}

export async function deleteFilter(
  url: string,
  token: string,
  baseId: string,
  viewId: string,
  filterId: string,
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/views/${viewId}/filters`, {
    url,
    method: 'DELETE',
    token,
    email,
    body: { id: filterId },
  });
}

// ---------------------------------------------------------------------------
// Sorts (v3)
// ---------------------------------------------------------------------------

export async function listSorts(
  url: string,
  token: string,
  baseId: string,
  viewId: string,
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/views/${viewId}/sorts`, { url, token, email });
}

export async function createSort(
  url: string,
  token: string,
  baseId: string,
  viewId: string,
  sort: { field_id: string; direction?: 'asc' | 'desc' },
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/views/${viewId}/sorts`, {
    url,
    method: 'POST',
    token,
    email,
    body: sort,
  });
}

export async function updateSort(
  url: string,
  token: string,
  baseId: string,
  viewId: string,
  sort: { id: string; field_id?: string; direction?: 'asc' | 'desc' },
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/views/${viewId}/sorts`, {
    url,
    method: 'PATCH',
    token,
    email,
    body: sort,
  });
}

export async function deleteSort(
  url: string,
  token: string,
  baseId: string,
  viewId: string,
  sortId: string,
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/views/${viewId}/sorts`, {
    url,
    method: 'DELETE',
    token,
    email,
    body: { id: sortId },
  });
}

// ---------------------------------------------------------------------------
// Comments (v3)
// ---------------------------------------------------------------------------

export async function listComments(
  url: string,
  token: string,
  baseId: string,
  tableId: string,
  rowId: string | number,
  email?: string,
): Promise<unknown> {
  const wsId = await resolveWsId(url, token, baseId, email);
  return iGet(url, token, wsId, baseId, 'commentList', {
    row_id: String(rowId),
    fk_model_id: tableId,
  }, email);
}

export async function createComment(
  url: string,
  token: string,
  baseId: string,
  tableId: string,
  rowId: string | number,
  comment: string,
  email?: string,
): Promise<unknown> {
  const wsId = await resolveWsId(url, token, baseId, email);
  return iPost(url, token, wsId, baseId, 'commentRow', {
    comment,
    row_id: String(rowId),
    fk_model_id: tableId,
  }, undefined, email);
}

export async function updateComment(
  url: string,
  token: string,
  baseId: string,
  commentId: string,
  comment: string,
  email?: string,
): Promise<unknown> {
  const wsId = await resolveWsId(url, token, baseId, email);
  return iPost(url, token, wsId, baseId, 'commentUpdate', {
    commentId,
    comment,
  }, undefined, email);
}

export async function deleteComment(
  url: string,
  token: string,
  baseId: string,
  commentId: string,
  email?: string,
): Promise<unknown> {
  const wsId = await resolveWsId(url, token, baseId, email);
  return iPost(url, token, wsId, baseId, 'commentDelete', {
    commentId,
  }, undefined, email);
}

// ---------------------------------------------------------------------------
// Links (v3) — uses /api/v3/data/:base/:table/links
// ---------------------------------------------------------------------------

export async function listLinks(
  url: string,
  token: string,
  base: string,
  table: string,
  columnId: string,
  rowId: string | number,
  params?: { limit?: number; offset?: number },
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/data/${base}/${table}/links/${columnId}/${rowId}`, {
    url,
    token,
    email,
    params: params as Record<string, string | number | undefined>,
  });
}

export async function linkRecords(
  url: string,
  token: string,
  base: string,
  table: string,
  columnId: string,
  rowId: string | number,
  ids: (string | number)[],
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/data/${base}/${table}/links/${columnId}/${rowId}`, {
    url,
    method: 'POST',
    token,
    email,
    body: ids,
  });
}

export async function unlinkRecords(
  url: string,
  token: string,
  base: string,
  table: string,
  columnId: string,
  rowId: string | number,
  ids: (string | number)[],
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/data/${base}/${table}/links/${columnId}/${rowId}`, {
    url,
    method: 'DELETE',
    token,
    email,
    body: ids,
  });
}

// ---------------------------------------------------------------------------
// Attachment Upload (v3)
// ---------------------------------------------------------------------------

export async function uploadAttachment(
  url: string,
  token: string,
  base: string,
  table: string,
  recordId: string | number,
  columnId: string,
  data: { contentType: string; file: string; filename: string },
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/data/${base}/${table}/records/${recordId}/fields/${columnId}/upload`, {
    url,
    method: 'POST',
    token,
    email,
    body: data,
  });
}

// ---------------------------------------------------------------------------
// API Tokens (v1)
// ---------------------------------------------------------------------------

export async function listTokens(url: string, token: string, email?: string): Promise<unknown> {
  return request('/api/v1/tokens', { url, token, email });
}

export async function createToken(url: string, token: string, title: string, email?: string): Promise<unknown> {
  return request('/api/v1/tokens', { url, method: 'POST', token, email, body: { description: title } });
}

export async function deleteToken(url: string, token: string, tokenId: string, email?: string): Promise<unknown> {
  return request(`/api/v1/tokens/${tokenId}`, { url, method: 'DELETE', token, email });
}

// ---------------------------------------------------------------------------
// Scripts (internal — EE only, v3 requires feature_api_script_management)
// ---------------------------------------------------------------------------

export async function listScripts(url: string, token: string, wsId: string, baseId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'listScripts', undefined, email);
}

export async function getScript(url: string, token: string, wsId: string, baseId: string, scriptId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'getScript', { id: scriptId }, email);
}

export async function createScript(
  url: string,
  token: string,
  wsId: string,
  baseId: string,
  script: Record<string, unknown>,
  email?: string,
): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'createScript', script, undefined, email);
}

export async function updateScript(
  url: string,
  token: string,
  wsId: string,
  baseId: string,
  scriptId: string,
  script: Record<string, unknown>,
  email?: string,
): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'updateScript', { ...script, id: scriptId }, undefined, email);
}

export async function deleteScript(url: string, token: string, wsId: string, baseId: string, scriptId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'deleteScript', {}, { scriptId }, email);
}

// ---------------------------------------------------------------------------
// Records (v3) — uses /api/v3/data/:base/:table/records
// ---------------------------------------------------------------------------

export interface ListRecordsParams {
  where?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  fields?: string;
  viewId?: string;
}

export async function listRecords(
  url: string,
  token: string,
  base: string,
  table: string,
  params?: ListRecordsParams,
  email?: string,
): Promise<RecordList> {
  return request(`/api/v3/data/${base}/${table}/records`, {
    url,
    token,
    email,
    params: params as Record<string, string | number | undefined>,
  });
}

export async function getRecord(
  url: string,
  token: string,
  base: string,
  table: string,
  rowId: string | number,
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/data/${base}/${table}/records/${rowId}`, { url, token, email });
}

export async function createRecord(
  url: string,
  token: string,
  base: string,
  table: string,
  data: Record<string, unknown>,
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/data/${base}/${table}/records?typecast=true`, {
    url,
    method: 'POST',
    token,
    email,
    body: { fields: data },
  });
}

export async function createRecords(
  url: string,
  token: string,
  base: string,
  table: string,
  data: Record<string, unknown>[],
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/data/${base}/${table}/records?typecast=true`, {
    url,
    method: 'POST',
    token,
    email,
    body: data.map((d) => ({ fields: d })),
  });
}

export async function updateRecord(
  url: string,
  token: string,
  base: string,
  table: string,
  id: string | number,
  data: Record<string, unknown>,
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/data/${base}/${table}/records`, {
    url,
    method: 'PATCH',
    token,
    email,
    body: { id, fields: data },
  });
}

export async function deleteRecord(
  url: string,
  token: string,
  base: string,
  table: string,
  rowId: string | number,
  email?: string,
): Promise<unknown> {
  return request(`/api/v3/data/${base}/${table}/records`, {
    url,
    method: 'DELETE',
    token,
    email,
    body: { id: rowId },
  });
}

export async function countRecords(
  url: string,
  token: string,
  base: string,
  table: string,
  where?: string,
  email?: string,
): Promise<CountResponse> {
  return request(`/api/v3/data/${base}/${table}/count`, {
    url,
    token,
    email,
    params: where ? { where } : undefined,
  });
}


// ===========================================================================
// INTERNAL API Operations
// ===========================================================================
//
// Routes through: GET/POST /api/v2/internal/:wsId/:baseId?operation=<name>
//
// Every NocoDB internal operation is wrapped below. These are the primary
// API paths used by the NocoDB frontend. Some overlap with v3 endpoints —
// prefer v3 for standard record CRUD; use internal for all other operations.
//
// Operation scopes:
//   base      — most operations (wsId + baseId required in URL)
//   workspace — wsId required, baseId can be any base in the workspace
//   org       — wsId/baseId required in URL but operation ignores them
// ===========================================================================

/** Generic internal API helper. Calls /api/v2/internal/:wsId/:baseId with the given operation. */
export async function internal(
  url: string,
  token: string,
  wsId: string,
  baseId: string,
  operation: string,
  opts: { method?: string; body?: unknown; params?: Record<string, string | number | string[] | undefined> } = {},
  email?: string,
): Promise<unknown> {
  const { method = 'POST', body, params } = opts;
  return request(`/api/v2/internal/${wsId}/${baseId}`, {
    url,
    method,
    token,
    email,
    body,
    params: { operation, ...params },
  });
}

// In-memory base→workspace cache (not persisted)
export const baseWsCache = new Map<string, string>();

/** Resolve workspace ID for a base — checks in-memory cache first, then fetches via API */
export async function resolveWsId(url: string, token: string, baseId: string, email?: string): Promise<string> {
  const cached = baseWsCache.get(baseId);
  if (cached) return cached;

  const base = await getBase(url, token, baseId, email);
  const wsId = base?.workspace_id;
  if (!wsId) throw new Error(`Could not resolve workspace for base ${baseId}`);

  baseWsCache.set(baseId, wsId);
  return wsId;
}

/** Internal GET shorthand */
function iGet(
  url: string, token: string, wsId: string, baseId: string, op: string,
  params?: Record<string, string | number | string[] | undefined>,
  email?: string,
): Promise<unknown> {
  return internal(url, token, wsId, baseId, op, { method: 'GET', params }, email);
}

/** Internal POST shorthand */
function iPost(
  url: string, token: string, wsId: string, baseId: string, op: string,
  body?: unknown, params?: Record<string, string | number | string[] | undefined>,
  email?: string,
): Promise<unknown> {
  return internal(url, token, wsId, baseId, op, { method: 'POST', body, params }, email);
}

/** Exported wrapper for iPost (used by init.ts for dashboard creation) */
export function iPostExported(
  url: string, token: string, wsId: string, baseId: string, op: string,
  body?: unknown, params?: Record<string, string | number | string[] | undefined>,
  email?: string,
): Promise<unknown> {
  return iPost(url, token, wsId, baseId, op, body, params, email);
}

// ---------------------------------------------------------------------------
// Internal: Tables & Columns
// ---------------------------------------------------------------------------

export function tableGet(url: string, token: string, wsId: string, baseId: string, tableId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'tableGet', { tableId }, email);
}

export function tableUpdate(url: string, token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'tableUpdate', body, { tableId }, email);
}

export function tableDelete(url: string, token: string, wsId: string, baseId: string, tableId: string, opts?: { forceDeleteRelations?: boolean }, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'tableDelete', opts, { tableId }, email);
}

export function tableReorder(url: string, token: string, wsId: string, baseId: string, tableId: string, order: number, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'tableReorder', { order }, { tableId }, email);
}

export function tableSampleData(url: string, token: string, wsId: string, baseId: string, tableId: string, opts?: { hookOperation?: string; version?: string; event?: string }, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'tableSampleData', { tableId, ...opts }, email);
}

export function columnsHash(url: string, token: string, wsId: string, baseId: string, tableId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'columnsHash', { tableId }, email);
}

export function columnAdd(url: string, token: string, wsId: string, baseId: string, tableId: string, column: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'columnAdd', column, { tableId }, email);
}

export function columnUpdate(url: string, token: string, wsId: string, baseId: string, columnId: string, column: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'columnUpdate', column, { columnId }, email);
}

export function columnDelete(url: string, token: string, wsId: string, baseId: string, columnId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'columnDelete', undefined, { columnId }, email);
}

export function columnSetAsPrimary(url: string, token: string, wsId: string, baseId: string, columnId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'columnSetAsPrimary', undefined, { columnId }, email);
}

export function columnsBulk(url: string, token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'columnsBulk', body, { tableId }, email);
}

// ---------------------------------------------------------------------------
// Internal: Views
// ---------------------------------------------------------------------------

export function viewList(url: string, token: string, wsId: string, baseId: string, tableId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'viewList', { tableId }, email);
}

export function viewUpdate(url: string, token: string, wsId: string, baseId: string, viewId: string, view: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'viewUpdate', view, { viewId }, email);
}

export function viewDelete(url: string, token: string, wsId: string, baseId: string, viewId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'viewDelete', undefined, { viewId }, email);
}

export function viewColumnList(url: string, token: string, wsId: string, baseId: string, viewId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'viewColumnList', { viewId }, email);
}

export function viewColumnUpdate(url: string, token: string, wsId: string, baseId: string, viewId: string, columnId: string, column: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'viewColumnUpdate', column, { viewId, columnId }, email);
}

export function viewColumnCreate(url: string, token: string, wsId: string, baseId: string, viewId: string, column: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'viewColumnCreate', column, { viewId }, email);
}

export function showAllColumns(url: string, token: string, wsId: string, baseId: string, viewId: string, ignoreIds?: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'showAllColumns', undefined, { viewId, ignoreIds }, email);
}

export function hideAllColumns(url: string, token: string, wsId: string, baseId: string, viewId: string, ignoreIds?: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'hideAllColumns', undefined, { viewId, ignoreIds }, email);
}

export function gridColumnUpdate(url: string, token: string, wsId: string, baseId: string, gridViewColumnId: string, grid: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'gridColumnUpdate', grid, { gridViewColumnId }, email);
}

// ---------------------------------------------------------------------------
// Internal: View Creation
// ---------------------------------------------------------------------------

export function gridViewCreate(url: string, token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'gridViewCreate', body, { tableId }, email);
}

export function formViewCreate(url: string, token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'formViewCreate', body, { tableId }, email);
}

export function galleryViewCreate(url: string, token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'galleryViewCreate', body, { tableId }, email);
}

export function kanbanViewCreate(url: string, token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'kanbanViewCreate', body, { tableId }, email);
}

export function mapViewCreate(url: string, token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'mapViewCreate', body, { tableId }, email);
}

export function calendarViewCreate(url: string, token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'calendarViewCreate', body, { tableId }, email);
}

// ---------------------------------------------------------------------------
// Internal: View Configs
// ---------------------------------------------------------------------------

export function formViewGet(url: string, token: string, wsId: string, baseId: string, formViewId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'formViewGet', { formViewId }, email);
}

export function formViewUpdate(url: string, token: string, wsId: string, baseId: string, viewId: string, form: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'formViewUpdate', form, { viewId }, email);
}

export function formColumnUpdate(url: string, token: string, wsId: string, baseId: string, formColumnId: string, column: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'formColumnUpdate', column, { formColumnId }, email);
}

export function galleryViewUpdate(url: string, token: string, wsId: string, baseId: string, viewId: string, gallery: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'galleryViewUpdate', gallery, { viewId }, email);
}

export function kanbanViewUpdate(url: string, token: string, wsId: string, baseId: string, viewId: string, kanban: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'kanbanViewUpdate', kanban, { viewId }, email);
}

export function gridViewUpdate(url: string, token: string, wsId: string, baseId: string, viewId: string, grid: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'gridViewUpdate', grid, { viewId }, email);
}

export function mapViewGet(url: string, token: string, wsId: string, baseId: string, mapViewId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'mapViewGet', { mapViewId }, email);
}

export function mapViewUpdate(url: string, token: string, wsId: string, baseId: string, viewId: string, map: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'mapViewUpdate', map, { viewId }, email);
}

export function calendarViewUpdate(url: string, token: string, wsId: string, baseId: string, viewId: string, calendar: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'calendarViewUpdate', calendar, { viewId }, email);
}

// ---------------------------------------------------------------------------
// Internal: Row Colors
// ---------------------------------------------------------------------------

export function viewRowColorInfo(url: string, token: string, wsId: string, baseId: string, viewId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'viewRowColorInfo', { viewId }, email);
}

export function viewRowColorConditionAdd(url: string, token: string, wsId: string, baseId: string, viewId: string, body: { color: string; is_set_as_background?: boolean; nc_order?: number; filter?: unknown }, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'viewRowColorConditionAdd', body, { viewId }, email);
}

export function viewRowColorConditionUpdate(url: string, token: string, wsId: string, baseId: string, viewId: string, rowColorConditionId: string, body: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'viewRowColorConditionUpdate', body, { viewId, rowColorConditionId }, email);
}

export function viewRowColorConditionDelete(url: string, token: string, wsId: string, baseId: string, viewId: string, rowColorConditionId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'viewRowColorConditionDelete', undefined, { viewId, rowColorConditionId }, email);
}

export function viewRowColorSelectAdd(url: string, token: string, wsId: string, baseId: string, viewId: string, body: { fk_column_id: string; is_set_as_background?: boolean }, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'viewRowColorSelectAdd', body, { viewId }, email);
}

export function viewRowColorInfoDelete(url: string, token: string, wsId: string, baseId: string, viewId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'viewRowColorInfoDelete', undefined, { viewId }, email);
}

// ---------------------------------------------------------------------------
// Internal: Filters
// ---------------------------------------------------------------------------

export function iFilterList(url: string, token: string, wsId: string, baseId: string, viewId: string, includeAllFilters?: boolean, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'filterList', { viewId, includeAllFilters: includeAllFilters ? 'true' : undefined }, email);
}

export function filterChildrenList(url: string, token: string, wsId: string, baseId: string, filterId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'filterChildrenList', { filterId }, email);
}

export function iFilterCreate(url: string, token: string, wsId: string, baseId: string, viewId: string, filter: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'filterCreate', filter, { viewId }, email);
}

export function iFilterUpdate(url: string, token: string, wsId: string, baseId: string, filterId: string, filter: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'filterUpdate', filter, { filterId }, email);
}

export function iFilterDelete(url: string, token: string, wsId: string, baseId: string, filterId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'filterDelete', undefined, { filterId }, email);
}

// ---------------------------------------------------------------------------
// Internal: Sorts
// ---------------------------------------------------------------------------

export function iSortList(url: string, token: string, wsId: string, baseId: string, viewId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'sortList', { viewId }, email);
}

export function iSortCreate(url: string, token: string, wsId: string, baseId: string, viewId: string, sort: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'sortCreate', sort, { viewId }, email);
}

export function iSortUpdate(url: string, token: string, wsId: string, baseId: string, sortId: string, sort: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'sortUpdate', sort, { sortId }, email);
}

export function iSortDelete(url: string, token: string, wsId: string, baseId: string, sortId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'sortDelete', undefined, { sortId }, email);
}

// ---------------------------------------------------------------------------
// Internal: Hooks
// ---------------------------------------------------------------------------

export function hookList(url: string, token: string, wsId: string, baseId: string, tableId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'hookList', { tableId }, email);
}

export function hookCreate(url: string, token: string, wsId: string, baseId: string, tableId: string, hook: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'hookCreate', hook, { tableId }, email);
}

export function hookUpdate(url: string, token: string, wsId: string, baseId: string, hookId: string, hook: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'hookUpdate', hook, { hookId }, email);
}

export function hookDelete(url: string, token: string, wsId: string, baseId: string, hookId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'hookDelete', undefined, { hookId }, email);
}

export function hookTest(url: string, token: string, wsId: string, baseId: string, tableId: string, hookTest: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'hookTest', hookTest, { tableId }, email);
}

export function hookTrigger(url: string, token: string, wsId: string, baseId: string, hookId: string, rowId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'hookTrigger', undefined, { hookId, rowId }, email);
}

export function hookLogList(url: string, token: string, wsId: string, baseId: string, hookId: string, params?: { limit?: number; offset?: number }, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'hookLogList', { hookId, ...params }, email);
}

export function hookFilterList(url: string, token: string, wsId: string, baseId: string, hookId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'hookFilterList', { hookId }, email);
}

export function hookFilterCreate(url: string, token: string, wsId: string, baseId: string, hookId: string, filter: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'hookFilterCreate', filter, { hookId }, email);
}

export function hookSamplePayload(url: string, token: string, wsId: string, baseId: string, tableId: string, opts?: { hookOperation?: string; version?: string; event?: string }, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'hookSamplePayload', { tableId, ...opts }, email);
}

// ---------------------------------------------------------------------------
// Internal: Shared Views
// ---------------------------------------------------------------------------

export function shareViewCreate(url: string, token: string, wsId: string, baseId: string, viewId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'shareView', undefined, { viewId }, email);
}

export function shareViewUpdate(url: string, token: string, wsId: string, baseId: string, viewId: string, sharedView: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'shareViewUpdate', sharedView, { viewId }, email);
}

export function shareViewDelete(url: string, token: string, wsId: string, baseId: string, viewId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'shareViewDelete', undefined, { viewId }, email);
}

// ---------------------------------------------------------------------------
// Internal: Data Operations
// ---------------------------------------------------------------------------

export function dataList(url: string, token: string, wsId: string, baseId: string, tableId: string, opts?: { viewId?: string; limit?: number; offset?: number; where?: string; sort?: string; fields?: string; includeSortAndFilterColumns?: boolean }, email?: string): Promise<unknown> {
  const { includeSortAndFilterColumns, ...rest } = opts || {};
  return iGet(url, token, wsId, baseId, 'dataList', {
    tableId,
    includeSortAndFilterColumns: includeSortAndFilterColumns ? 'true' : undefined,
    ...rest,
  }, email);
}

export function dataInsert(url: string, token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>, opts?: { viewId?: string; undo?: boolean }, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'dataInsert', body, { tableId, viewId: opts?.viewId, undo: opts?.undo ? 'true' : undefined }, email);
}

export function dataUpdate(url: string, token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>, opts?: { viewId?: string }, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'dataUpdate', body, { tableId, viewId: opts?.viewId }, email);
}

export function dataDelete(url: string, token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>, opts?: { viewId?: string }, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'dataDelete', body, { tableId, viewId: opts?.viewId }, email);
}

export function dataExport(url: string, token: string, wsId: string, baseId: string, viewId: string, exportAs: string, options?: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'dataExport', { exportAs, options }, { viewId }, email);
}

export function dataAggregate(url: string, token: string, wsId: string, baseId: string, tableId: string, opts?: { viewId?: string; [k: string]: unknown }, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'dataAggregate', { tableId, ...opts }, email);
}

export function bulkDataList(url: string, token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>, opts?: { viewId?: string }, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'bulkDataList', body, { tableId, viewId: opts?.viewId }, email);
}

export function bulkAggregate(url: string, token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>, opts?: { viewId?: string }, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'bulkAggregate', body, { tableId, viewId: opts?.viewId }, email);
}

export function bulkDataDeleteAll(url: string, token: string, wsId: string, baseId: string, tableId: string, opts?: { viewId?: string; where?: string }, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'bulkDataDeleteAll', undefined, { tableId, ...opts }, email);
}

// ---------------------------------------------------------------------------
// Internal: Nested / Linked Data
// ---------------------------------------------------------------------------

export function nestedDataList(url: string, token: string, wsId: string, baseId: string, tableId: string, rowId: string, columnId: string, opts?: { viewId?: string; limit?: number; offset?: number }, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'nestedDataList', { tableId, rowId, columnId, ...opts }, email);
}

export function nestedDataLink(url: string, token: string, wsId: string, baseId: string, tableId: string, rowId: string, columnId: string, refRowIds: unknown[], opts?: { viewId?: string }, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'nestedDataLink', refRowIds, { tableId, rowId, columnId, viewId: opts?.viewId }, email);
}

export function nestedDataUnlink(url: string, token: string, wsId: string, baseId: string, tableId: string, rowId: string, columnId: string, refRowIds: unknown[], opts?: { viewId?: string }, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'nestedDataUnlink', refRowIds, { tableId, rowId, columnId, viewId: opts?.viewId }, email);
}

export function nestedDataListCopyPasteOrDeleteAll(url: string, token: string, wsId: string, baseId: string, tableId: string, columnId: string, data: unknown, opts?: { viewId?: string }, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'nestedDataListCopyPasteOrDeleteAll', data, { tableId, columnId, viewId: opts?.viewId }, email);
}

export function linkDataList(url: string, token: string, wsId: string, baseId: string, columnId: string, opts?: { tableId?: string; viewId?: string; rowId?: string; limit?: number; offset?: number }, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'linkDataList', { columnId, ...opts }, email);
}

// ---------------------------------------------------------------------------
// Internal: Comments
// ---------------------------------------------------------------------------

export function commentList(url: string, token: string, wsId: string, baseId: string, fk_model_id: string, row_id: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'commentList', { fk_model_id, row_id }, email);
}

export function commentCount(url: string, token: string, wsId: string, baseId: string, fk_model_id: string, ids: string[], email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'commentCount', { fk_model_id, ids }, email);
}

export function commentRow(url: string, token: string, wsId: string, baseId: string, body: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'commentRow', body, undefined, email);
}

export function iCommentUpdate(url: string, token: string, wsId: string, baseId: string, commentId: string, body: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'commentUpdate', { commentId, ...body }, undefined, email);
}

export function iCommentDelete(url: string, token: string, wsId: string, baseId: string, commentId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'commentDelete', { commentId }, undefined, email);
}

export function commentResolve(url: string, token: string, wsId: string, baseId: string, commentId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'commentResolve', { commentId }, undefined, email);
}

// ---------------------------------------------------------------------------
// Internal: Extensions
// ---------------------------------------------------------------------------

export function extensionList(url: string, token: string, wsId: string, baseId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'extensionList', undefined, email);
}

export function extensionRead(url: string, token: string, wsId: string, baseId: string, extensionId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'extensionRead', { extensionId }, email);
}

export function extensionCreate(url: string, token: string, wsId: string, baseId: string, extension: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'extensionCreate', extension, undefined, email);
}

export function extensionUpdate(url: string, token: string, wsId: string, baseId: string, extensionId: string, extension: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'extensionUpdate', extension, { extensionId }, email);
}

export function extensionDelete(url: string, token: string, wsId: string, baseId: string, extensionId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'extensionDelete', undefined, { extensionId }, email);
}

// ---------------------------------------------------------------------------
// Internal: Sync Sources
// ---------------------------------------------------------------------------

export function syncSourceList(url: string, token: string, wsId: string, baseId: string, sourceId?: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'syncSourceList', sourceId ? { sourceId } : undefined, email);
}

export function syncSourceCreate(url: string, token: string, wsId: string, baseId: string, sourceId: string, payload: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'syncSourceCreate', payload, { sourceId }, email);
}

export function syncSourceUpdate(url: string, token: string, wsId: string, baseId: string, syncId: string, payload: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'syncSourceUpdate', payload, { syncId }, email);
}

export function syncSourceDelete(url: string, token: string, wsId: string, baseId: string, syncId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'syncSourceDelete', undefined, { syncId }, email);
}

export function atImportTrigger(url: string, token: string, wsId: string, baseId: string, syncId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'atImportTrigger', undefined, { syncId }, email);
}

// ---------------------------------------------------------------------------
// Internal: Dependencies & Audit
// ---------------------------------------------------------------------------

export function checkDependency(url: string, token: string, wsId: string, baseId: string, body: { entityType: string; entityId: string }, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'checkDependency', body, undefined, email);
}

export function recordAuditList(url: string, token: string, wsId: string, baseId: string, fk_model_id: string, row_id: string, cursor?: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'recordAuditList', { fk_model_id, row_id, cursor }, email);
}

// ---------------------------------------------------------------------------
// Internal: MCP Tokens
// ---------------------------------------------------------------------------

export function mcpList(url: string, token: string, wsId: string, baseId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'mcpList', undefined, email);
}

export function mcpGet(url: string, token: string, wsId: string, baseId: string, tokenId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'mcpGet', { tokenId }, email);
}

export function mcpRootList(url: string, token: string, wsId: string, baseId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'mcpRootList', undefined, email);
}

export function mcpCreate(url: string, token: string, wsId: string, baseId: string, body: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'mcpCreate', body, undefined, email);
}

export function mcpUpdate(url: string, token: string, wsId: string, baseId: string, tokenId: string, body: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'mcpUpdate', { tokenId, ...body }, undefined, email);
}

export function mcpDelete(url: string, token: string, wsId: string, baseId: string, tokenId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'mcpDelete', { tokenId }, undefined, email);
}

// ---------------------------------------------------------------------------
// Internal: OAuth Clients (org-scoped)
// ---------------------------------------------------------------------------

export function oAuthClientList(url: string, token: string, wsId: string, baseId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'oAuthClientList', undefined, email);
}

export function oAuthClientGet(url: string, token: string, wsId: string, baseId: string, clientId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'oAuthClientGet', { clientId }, email);
}

export function oAuthClientCreate(url: string, token: string, wsId: string, baseId: string, body: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'oAuthClientCreate', body, undefined, email);
}

export function oAuthClientUpdate(url: string, token: string, wsId: string, baseId: string, clientId: string, body: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'oAuthClientUpdate', body, { clientId }, email);
}

export function oAuthClientDelete(url: string, token: string, wsId: string, baseId: string, clientId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'oAuthClientDelete', undefined, { clientId }, email);
}

export function oAuthClientRegenerateSecret(url: string, token: string, wsId: string, baseId: string, clientId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'oAuthClientRegenerateSecret', undefined, { clientId }, email);
}

export function oAuthAuthorizationList(url: string, token: string, wsId: string, baseId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'oAuthAuthorizationList', undefined, email);
}

export function oAuthAuthorizationRevoke(url: string, token: string, wsId: string, baseId: string, tokenId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'oAuthAuthorizationRevoke', { tokenId }, undefined, email);
}

// ---------------------------------------------------------------------------
// Internal: EE Filters (link/widget/rowColor)
// ---------------------------------------------------------------------------

export function linkFilterList(url: string, token: string, wsId: string, baseId: string, columnId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'linkFilterList', { columnId }, email);
}

export function widgetFilterList(url: string, token: string, wsId: string, baseId: string, widgetId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'widgetFilterList', { widgetId }, email);
}

export function linkFilterCreate(url: string, token: string, wsId: string, baseId: string, columnId: string, filter: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'linkFilterCreate', filter, { columnId }, email);
}

export function widgetFilterCreate(url: string, token: string, wsId: string, baseId: string, widgetId: string, filter: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'widgetFilterCreate', filter, { widgetId }, email);
}

export function rowColorConditionsFilterCreate(url: string, token: string, wsId: string, baseId: string, rowColorConditionId: string, filter: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'rowColorConditionsFilterCreate', filter, { rowColorConditionId }, email);
}

// ---------------------------------------------------------------------------
// Internal: Workflows (EE)
// ---------------------------------------------------------------------------

export function workflowList(url: string, token: string, wsId: string, baseId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'workflowList', undefined, email);
}

export function workflowGet(url: string, token: string, wsId: string, baseId: string, workflowId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'workflowGet', { workflowId }, email);
}

export function workflowExecutionList(url: string, token: string, wsId: string, baseId: string, workflowId: string, opts?: { limit?: number; offset?: number }, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'workflowExecutionList', { workflowId, ...opts }, email);
}

export function workflowExecutionGet(url: string, token: string, wsId: string, baseId: string, workflowId: string, executionId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'workflowExecutionGet', { workflowId, executionId }, email);
}

export function workflowNodes(url: string, token: string, wsId: string, baseId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'workflowNodes', undefined, email);
}

export function workflowListSubscribers(url: string, token: string, wsId: string, baseId: string, workflowId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'workflowListSubscribers', { workflowId }, email);
}

export function workflowCreate(url: string, token: string, wsId: string, baseId: string, body: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'workflowCreate', body, undefined, email);
}

export function workflowUpdate(url: string, token: string, wsId: string, baseId: string, workflowId: string, body: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'workflowUpdate', { workflowId, ...body }, undefined, email);
}

export function workflowDelete(url: string, token: string, wsId: string, baseId: string, workflowId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'workflowDelete', { workflowId }, undefined, email);
}

export function workflowDuplicate(url: string, token: string, wsId: string, baseId: string, workflowId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'workflowDuplicate', { workflowId }, undefined, email);
}

export function workflowExecute(url: string, token: string, wsId: string, baseId: string, workflowId: string, body?: { triggerData?: unknown; triggerNodeTitle?: string }, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'workflowExecute', { workflowId, ...body }, undefined, email);
}

export function workflowNodeIntegrationFetchOptions(url: string, token: string, wsId: string, baseId: string, body: { integration: string; key: string }, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'workflowNodeIntegrationFetchOptions', body, undefined, email);
}

export function workflowTestNode(url: string, token: string, wsId: string, baseId: string, body: { workflowId: string; nodeId: string; testTriggerData?: unknown; testMode?: string }, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'workflowTestNode', body, undefined, email);
}

export function workflowPublish(url: string, token: string, wsId: string, baseId: string, workflowId: string, cancelPendingExecutions?: boolean, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'workflowPublish', { workflowId, cancelPendingExecutions }, undefined, email);
}

export function workflowAddSubscribers(url: string, token: string, wsId: string, baseId: string, workflowId: string, userIds: string[], email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'workflowAddSubscribers', { workflowId, userIds }, undefined, email);
}

export function workflowRemoveSubscriber(url: string, token: string, wsId: string, baseId: string, subscriberId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'workflowRemoveSubscriber', { subscriberId }, undefined, email);
}

// ---------------------------------------------------------------------------
// Internal: Managed Apps (EE)
// ---------------------------------------------------------------------------

export function managedAppStoreList(url: string, token: string, wsId: string, baseId: string, opts?: { category?: string; search?: string; limit?: number; offset?: number }, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'managedAppStoreList', opts as Record<string, string | number | undefined>, email);
}

export function managedAppList(url: string, token: string, wsId: string, baseId: string, opts?: { limit?: number; offset?: number }, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'managedAppList', opts as Record<string, string | number | undefined>, email);
}

export function managedAppGet(url: string, token: string, wsId: string, baseId: string, managedAppId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'managedAppGet', { managedAppId }, email);
}

export function managedAppGetUpdates(url: string, token: string, wsId: string, baseId: string, managedAppId: string, installedBaseId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'managedAppGetUpdates', { managedAppId, installedBaseId }, email);
}

export function managedAppVersionsList(url: string, token: string, wsId: string, baseId: string, managedAppId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'managedAppVersionsList', { managedAppId }, email);
}

export function managedAppDeployments(url: string, token: string, wsId: string, baseId: string, managedAppId: string, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'managedAppDeployments', { managedAppId }, email);
}

export function managedAppVersionDeployments(url: string, token: string, wsId: string, baseId: string, managedAppId: string, versionId: string, opts?: { limit?: number; offset?: number }, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'managedAppVersionDeployments', { managedAppId, versionId, ...opts }, email);
}

export function managedAppDeploymentLogs(url: string, token: string, wsId: string, baseId: string, logsBaseId: string, opts?: { limit?: number; offset?: number }, email?: string): Promise<unknown> {
  return iGet(url, token, wsId, baseId, 'managedAppDeploymentLogs', { baseId: logsBaseId, ...opts }, email);
}

export function managedAppCreate(url: string, token: string, wsId: string, baseId: string, body: { title: string; visibility?: string; basePayload?: unknown }, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'managedAppCreate', body, undefined, email);
}

export function managedAppUpdate(url: string, token: string, wsId: string, baseId: string, managedAppId: string, body: Record<string, unknown>, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'managedAppUpdate', { managedAppId, ...body }, undefined, email);
}

export function managedAppDelete(url: string, token: string, wsId: string, baseId: string, managedAppId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'managedAppDelete', { managedAppId }, undefined, email);
}

export function managedAppPublish(url: string, token: string, wsId: string, baseId: string, managedAppVersionId: string, releaseNotes?: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'managedAppPublish', { managedAppVersionId, releaseNotes }, undefined, email);
}

export function managedAppCreateDraft(url: string, token: string, wsId: string, baseId: string, managedAppId: string, version: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'managedAppCreateDraft', { managedAppId, version }, undefined, email);
}

export function managedAppDiscardDraft(url: string, token: string, wsId: string, baseId: string, managedAppId: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'managedAppDiscardDraft', { managedAppId }, undefined, email);
}

export function managedAppInstall(url: string, token: string, wsId: string, baseId: string, managedAppId: string, target_workspace_id: string, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'managedAppInstall', { managedAppId, target_workspace_id }, undefined, email);
}

// ---------------------------------------------------------------------------
// Internal: Integration Options (EE)
// ---------------------------------------------------------------------------

export function integrationFetchOptions(url: string, token: string, wsId: string, baseId: string, body: { integration: string; key: string; params?: unknown }, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'integrationFetchOptions', body, undefined, email);
}

// ---------------------------------------------------------------------------
// Internal: Send Record Email (EE)
// ---------------------------------------------------------------------------

export function sendRecordEmail(url: string, token: string, wsId: string, baseId: string, body: { tableId: string; rowId: string; emails: string[]; subject?: string; message?: string; viewId?: string; sendCopyToSelf?: boolean }, email?: string): Promise<unknown> {
  return iPost(url, token, wsId, baseId, 'sendRecordEmail', body, undefined, email);
}

// ===========================================================================
// REST API Fallbacks (no internal equivalent available)
// ===========================================================================

// ---------------------------------------------------------------------------
// Shared View Listing (v1) — no internal list operation available
// ---------------------------------------------------------------------------

export async function listSharedViews(url: string, token: string, baseId: string, tableId: string, email?: string): Promise<unknown> {
  return request(`/api/v1/db/meta/tables/${tableId}/share`, { url, token, email });
}

// ---------------------------------------------------------------------------
// Shared Bases (v2)
// ---------------------------------------------------------------------------

export async function getSharedBase(url: string, token: string, baseId: string, email?: string): Promise<unknown> {
  return request(`/api/v2/meta/bases/${baseId}/shared`, { url, token, email });
}

export async function createSharedBase(url: string, token: string, baseId: string, email?: string): Promise<unknown> {
  return request(`/api/v2/meta/bases/${baseId}/shared`, { url, method: 'POST', token, email });
}

export async function updateSharedBase(
  url: string,
  token: string,
  baseId: string,
  data: Record<string, unknown>,
  email?: string,
): Promise<unknown> {
  return request(`/api/v2/meta/bases/${baseId}/shared`, { url, method: 'PATCH', token, email, body: data });
}

export async function deleteSharedBase(url: string, token: string, baseId: string, email?: string): Promise<unknown> {
  return request(`/api/v2/meta/bases/${baseId}/shared`, { url, method: 'DELETE', token, email });
}

// ---------------------------------------------------------------------------
// Public Shared View Data (no auth needed)
// ---------------------------------------------------------------------------

export async function getSharedViewMeta(url: string, uuid: string): Promise<unknown> {
  return request(`/api/v2/public/shared-view/${uuid}/meta`, { url });
}

export async function getSharedViewRows(
  url: string,
  uuid: string,
  params?: Record<string, string | number | undefined>,
): Promise<unknown> {
  return request(`/api/v2/public/shared-view/${uuid}/rows`, { url, params });
}

export async function submitSharedViewRow(
  url: string,
  uuid: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  return request(`/api/v2/public/shared-view/${uuid}/rows`, {
    url,
    method: 'POST',
    body: data,
  });
}

// ---------------------------------------------------------------------------
// File Storage / Attachments (v2)
// ---------------------------------------------------------------------------

export async function uploadFile(
  url: string,
  token: string,
  filePath: string,
  params?: { path?: string },
  email?: string,
): Promise<unknown> {
  const base = url.replace(/\/+$/, '');
  const qs = params?.path ? `?path=${encodeURIComponent(params.path)}` : '';
  const { readFileSync } = await import('node:fs');
  const { basename } = await import('node:path');
  const fileBuffer = readFileSync(filePath);
  const fileName = basename(filePath);

  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer]), fileName);

  const res = await fetch(`${base}/api/v2/storage/upload${qs}`, {
    method: 'POST',
    headers: { 'xc-auth': token },
    body: formData,
  });

  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${res.status} ${typeof data === 'object' && data && 'msg' in data ? (data as any).msg : text}`);
  return data;
}

export async function uploadByUrl(
  url: string,
  token: string,
  urls: Array<{ url: string; fileName?: string }>,
  params?: { path?: string },
  email?: string,
): Promise<unknown> {
  return request('/api/v2/storage/upload-by-url', {
    url,
    method: 'POST',
    token,
    email,
    body: urls,
    params: params?.path ? { path: params.path } : undefined,
  });
}

// ---------------------------------------------------------------------------
// Bulk Data Operations (v1 — by table name alias)
// ---------------------------------------------------------------------------

export async function bulkInsert(
  url: string,
  token: string,
  base: string,
  table: string,
  records: Record<string, unknown>[],
  email?: string,
): Promise<unknown> {
  return request(`/api/v1/db/data/bulk/noco/${base}/${table}`, {
    url,
    method: 'POST',
    token,
    email,
    body: records,
  });
}

export async function bulkUpdate(
  url: string,
  token: string,
  base: string,
  table: string,
  records: Array<Record<string, unknown>>,
  email?: string,
): Promise<unknown> {
  return request(`/api/v1/db/data/bulk/noco/${base}/${table}`, {
    url,
    method: 'PATCH',
    token,
    email,
    body: records,
  });
}

export async function bulkDelete(
  url: string,
  token: string,
  base: string,
  table: string,
  ids: Array<Record<string, unknown>>,
  email?: string,
): Promise<unknown> {
  return request(`/api/v1/db/data/bulk/noco/${base}/${table}`, {
    url,
    method: 'DELETE',
    token,
    email,
    body: ids,
  });
}

export async function bulkUpdateAll(
  url: string,
  token: string,
  base: string,
  table: string,
  body: { where?: string; fields: Record<string, unknown> },
  email?: string,
): Promise<unknown> {
  return request(`/api/v1/db/data/bulk/noco/${base}/${table}/all`, {
    url,
    method: 'PATCH',
    token,
    email,
    body,
  });
}

export async function bulkDeleteAll(
  url: string,
  token: string,
  base: string,
  table: string,
  body: { where?: string },
  email?: string,
): Promise<unknown> {
  return request(`/api/v1/db/data/bulk/noco/${base}/${table}/all`, {
    url,
    method: 'DELETE',
    token,
    email,
    body,
  });
}

// ---------------------------------------------------------------------------
// Notifications (v1)
// ---------------------------------------------------------------------------

export async function listNotifications(url: string, token: string, email?: string): Promise<unknown> {
  return request('/api/v1/notifications', { url, token, email });
}

export async function markNotificationRead(
  url: string,
  token: string,
  notificationId: string,
  data: Record<string, unknown>,
  email?: string,
): Promise<unknown> {
  return request(`/api/v1/notifications/${notificationId}`, {
    url,
    method: 'PATCH',
    token,
    email,
    body: data,
  });
}

export async function deleteNotification(url: string, token: string, notificationId: string, email?: string): Promise<unknown> {
  return request(`/api/v1/notifications/${notificationId}`, { url, method: 'DELETE', token, email });
}

export async function markAllNotificationsRead(url: string, token: string, email?: string): Promise<unknown> {
  return request('/api/v1/notifications/mark-all-read', { url, method: 'POST', token, email });
}

// ---------------------------------------------------------------------------
// Gallery View GET (v1)
// ---------------------------------------------------------------------------

export async function getGalleryView(url: string, token: string, baseId: string, galleryViewId: string, email?: string): Promise<unknown> {
  return request(`/api/v1/db/meta/galleries/${galleryViewId}`, { url, token, email });
}

// ---------------------------------------------------------------------------
// Kanban View GET (v1)
// ---------------------------------------------------------------------------

export async function getKanbanView(url: string, token: string, baseId: string, kanbanViewId: string, email?: string): Promise<unknown> {
  return request(`/api/v1/db/meta/kanbans/${kanbanViewId}`, { url, token, email });
}

// ---------------------------------------------------------------------------
// Grid Columns List (v1)
// ---------------------------------------------------------------------------

export async function listGridColumns(url: string, token: string, baseId: string, gridViewId: string, email?: string): Promise<unknown> {
  return request(`/api/v1/db/meta/grids/${gridViewId}/grid-columns`, { url, token, email });
}

// ---------------------------------------------------------------------------
// Calendar Data (v1)
// ---------------------------------------------------------------------------

export async function calendarData(
  url: string,
  token: string,
  base: string,
  table: string,
  viewName: string,
  params?: Record<string, string | number | undefined>,
  email?: string,
): Promise<unknown> {
  return request(`/api/v1/db/calendar-data/noco/${base}/${table}/views/${viewName}`, {
    url,
    token,
    email,
    params,
  });
}

export async function calendarCountByDate(
  url: string,
  token: string,
  base: string,
  table: string,
  viewName: string,
  params?: Record<string, string | number | undefined>,
  email?: string,
): Promise<unknown> {
  return request(`/api/v1/db/calendar-data/noco/${base}/${table}/views/${viewName}/countByDate`, {
    url,
    token,
    email,
    params,
  });
}

// ---------------------------------------------------------------------------
// Base Users / Collaborators (v1)
// ---------------------------------------------------------------------------

export async function listBaseUsers(url: string, token: string, baseId: string, email?: string): Promise<unknown> {
  return request(`/api/v1/db/meta/projects/${baseId}/users`, { url, token, email });
}

export async function inviteBaseUser(
  url: string,
  token: string,
  baseId: string,
  inviteEmail: string,
  roles: string,
  email?: string,
): Promise<unknown> {
  return request(`/api/v1/db/meta/projects/${baseId}/users`, {
    url,
    method: 'POST',
    token,
    email,
    body: { email: inviteEmail, roles },
  });
}

export async function updateBaseUser(
  url: string,
  token: string,
  baseId: string,
  userId: string,
  roles: string,
  email?: string,
): Promise<unknown> {
  return request(`/api/v1/db/meta/projects/${baseId}/users/${userId}`, {
    url,
    method: 'PATCH',
    token,
    email,
    body: { roles },
  });
}

export async function removeBaseUser(
  url: string,
  token: string,
  baseId: string,
  userId: string,
  email?: string,
): Promise<unknown> {
  return request(`/api/v1/db/meta/projects/${baseId}/users/${userId}`, {
    url,
    method: 'DELETE',
    token,
    email,
  });
}

// ---------------------------------------------------------------------------
// Integrations CRUD (v2 — workspace-scoped)
// ---------------------------------------------------------------------------

export async function listIntegrations(url: string, token: string, wsId: string, email?: string): Promise<unknown> {
  return request(`/api/v2/meta/workspaces/${wsId}/integrations`, { url, token, email });
}

export async function getIntegration(url: string, token: string, _wsId: string, integrationId: string, email?: string): Promise<unknown> {
  return request(`/api/v2/meta/integrations/${integrationId}`, { url, token, email });
}

export async function createIntegration(
  url: string,
  token: string,
  wsId: string,
  data: Record<string, unknown>,
  email?: string,
): Promise<unknown> {
  return request(`/api/v2/meta/workspaces/${wsId}/integrations`, { url, method: 'POST', token, email, body: data });
}

export async function updateIntegration(
  url: string,
  token: string,
  _wsId: string,
  integrationId: string,
  data: Record<string, unknown>,
  email?: string,
): Promise<unknown> {
  return request(`/api/v2/meta/integrations/${integrationId}`, {
    url,
    method: 'PATCH',
    token,
    email,
    body: data,
  });
}

export async function deleteIntegration(url: string, token: string, _wsId: string, integrationId: string, email?: string): Promise<unknown> {
  return request(`/api/v2/meta/integrations/${integrationId}`, { url, method: 'DELETE', token, email });
}

// ---------------------------------------------------------------------------
// Sources / Data Sources (v1)
// ---------------------------------------------------------------------------

export async function listSources(url: string, token: string, baseId: string, email?: string): Promise<unknown> {
  return request(`/api/v1/db/meta/projects/${baseId}/bases`, { url, token, email });
}

export async function getSource(
  url: string,
  token: string,
  baseId: string,
  sourceId: string,
  email?: string,
): Promise<unknown> {
  return request(`/api/v1/db/meta/projects/${baseId}/bases/${sourceId}`, { url, token, email });
}

export async function updateSource(
  url: string,
  token: string,
  baseId: string,
  sourceId: string,
  data: Record<string, unknown>,
  email?: string,
): Promise<unknown> {
  return request(`/api/v1/db/meta/projects/${baseId}/bases/${sourceId}`, {
    url,
    method: 'PATCH',
    token,
    email,
    body: data,
  });
}

// ---------------------------------------------------------------------------
// Snapshots (v2 — EE)
// ---------------------------------------------------------------------------

export async function listSnapshots(url: string, token: string, baseId: string, email?: string): Promise<unknown> {
  return request(`/api/v2/meta/bases/${baseId}/snapshots`, { url, token, email });
}

export async function updateSnapshot(
  url: string,
  token: string,
  baseId: string,
  snapshotId: string,
  data: Record<string, unknown>,
  email?: string,
): Promise<unknown> {
  return request(`/api/v2/meta/bases/${baseId}/snapshots/${snapshotId}`, {
    url,
    method: 'PATCH',
    token,
    email,
    body: data,
  });
}

export async function deleteSnapshot(
  url: string,
  token: string,
  baseId: string,
  snapshotId: string,
  email?: string,
): Promise<unknown> {
  return request(`/api/v2/meta/bases/${baseId}/snapshots/${snapshotId}`, {
    url,
    method: 'DELETE',
    token,
    email,
  });
}

// ---------------------------------------------------------------------------
// Plugins (v1)
// ---------------------------------------------------------------------------

export async function listPlugins(url: string, token: string, email?: string): Promise<unknown> {
  return request('/api/v1/db/meta/plugins', { url, token, email });
}

export async function getPlugin(url: string, token: string, pluginId: string, email?: string): Promise<unknown> {
  return request(`/api/v1/db/meta/plugins/${pluginId}`, { url, token, email });
}

export async function updatePlugin(
  url: string,
  token: string,
  pluginId: string,
  data: Record<string, unknown>,
  email?: string,
): Promise<unknown> {
  return request(`/api/v1/db/meta/plugins/${pluginId}`, { url, method: 'PATCH', token, email, body: data });
}

export async function testPlugin(url: string, token: string, data: Record<string, unknown>, email?: string): Promise<unknown> {
  return request('/api/v1/db/meta/plugins/test', { url, method: 'POST', token, email, body: data });
}

// ---------------------------------------------------------------------------
// Model Visibilities / UI ACL (v1)
// ---------------------------------------------------------------------------

export async function getVisibilityRules(url: string, token: string, baseId: string, email?: string): Promise<unknown> {
  return request(`/api/v1/db/meta/projects/${baseId}/visibility-rules`, { url, token, email });
}

export async function setVisibilityRules(
  url: string,
  token: string,
  baseId: string,
  rules: unknown,
  email?: string,
): Promise<unknown> {
  return request(`/api/v1/db/meta/projects/${baseId}/visibility-rules`, {
    url,
    method: 'POST',
    token,
    email,
    body: rules,
  });
}

// ---------------------------------------------------------------------------
// Org Users (v2 — super admin)
// ---------------------------------------------------------------------------

export async function listOrgUsers(
  url: string,
  token: string,
  orgId: string,
  params?: Record<string, string | number | undefined>,
  email?: string,
): Promise<unknown> {
  return request(`/api/v2/orgs/${orgId}/users`, { url, token, email, params });
}

export async function createOrgUser(
  url: string,
  token: string,
  orgId: string,
  data: Record<string, unknown>,
  email?: string,
): Promise<unknown> {
  return request(`/api/v2/orgs/${orgId}/users`, { url, method: 'POST', token, email, body: data });
}

export async function updateOrgUser(
  url: string,
  token: string,
  orgId: string,
  userId: string,
  data: Record<string, unknown>,
  email?: string,
): Promise<unknown> {
  return request(`/api/v2/orgs/${orgId}/user/${userId}`, { url, method: 'PATCH', token, email, body: data });
}

export async function deleteOrgUser(url: string, token: string, orgId: string, userId: string, email?: string): Promise<unknown> {
  return request(`/api/v2/orgs/${orgId}/user/${userId}`, { url, method: 'DELETE', token, email });
}

// ---------------------------------------------------------------------------
// Org Tokens (v1)
// ---------------------------------------------------------------------------

export async function listOrgTokens(url: string, token: string, email?: string): Promise<unknown> {
  return request('/api/v1/tokens', { url, token, email });
}

export async function createOrgToken(
  url: string,
  token: string,
  data: Record<string, unknown>,
  email?: string,
): Promise<unknown> {
  return request('/api/v1/tokens', { url, method: 'POST', token, email, body: data });
}

export async function deleteOrgToken(url: string, token: string, tokenId: string, email?: string): Promise<unknown> {
  return request(`/api/v1/tokens/${tokenId}`, { url, method: 'DELETE', token, email });
}

// ---------------------------------------------------------------------------
// Jobs (v2)
// ---------------------------------------------------------------------------

export async function listJobs(
  url: string,
  token: string,
  baseId: string,
  filter?: Record<string, unknown>,
  email?: string,
): Promise<unknown> {
  return request(`/api/v2/jobs/${baseId}`, { url, method: 'POST', token, email, body: filter || {} });
}

// ---------------------------------------------------------------------------
// Swagger / API Docs
// ---------------------------------------------------------------------------

export async function getSwagger(url: string, token: string, baseId: string, email?: string): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/swagger.json`, { url, token, email });
}

// ---------------------------------------------------------------------------
// App Info / Utils
// ---------------------------------------------------------------------------

export async function appInfo(url: string, token: string, email?: string): Promise<unknown> {
  return request('/api/v1/db/meta/nocodb/info', { url, token, email });
}

export async function testConnection(
  url: string,
  token: string,
  data: Record<string, unknown>,
  email?: string,
): Promise<unknown> {
  return request('/api/v1/db/meta/connection/test', { url, method: 'POST', token, email, body: data });
}

// ---------------------------------------------------------------------------
// Cache Admin (v1)
// ---------------------------------------------------------------------------

export async function getCache(url: string, token: string, email?: string): Promise<unknown> {
  return request('/api/v1/db/meta/cache', { url, token, email });
}

export async function clearCache(url: string, token: string, email?: string): Promise<unknown> {
  return request('/api/v1/db/meta/cache', { url, method: 'DELETE', token, email });
}

// ---------------------------------------------------------------------------
// User Profile (v2)
// ---------------------------------------------------------------------------

export async function updateProfile(
  url: string,
  token: string,
  data: Record<string, unknown>,
  email?: string,
): Promise<unknown> {
  return request('/api/v2/meta/user/profile', { url, method: 'PATCH', token, email, body: data });
}

// ---------------------------------------------------------------------------
// SQL View (v1)
// ---------------------------------------------------------------------------

export async function createSqlView(
  url: string,
  token: string,
  baseId: string,
  sourceId: string,
  data: Record<string, unknown>,
  email?: string,
): Promise<unknown> {
  return request(`/api/v1/db/meta/projects/${baseId}/bases/${sourceId}/sqlView`, {
    url,
    method: 'POST',
    token,
    email,
    body: data,
  });
}
