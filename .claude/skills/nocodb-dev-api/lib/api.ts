import { getBaseUrl } from './state.js';
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
  method?: string;
  token?: string;
  body?: unknown;
  params?: Record<string, string | number | string[] | undefined>;
}

export async function request<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', token, body, params } = opts;
  const base = getBaseUrl().replace(/\/+$/, '');

  let url = `${base}${path}`;
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
    if (parts.length) url += `?${parts.join('&')}`;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['xc-auth'] = token;

  const res = await fetch(url, {
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

export async function signin(email: string, password: string): Promise<SigninResponse> {
  return request('/api/v1/auth/user/signin', { method: 'POST', body: { email, password } });
}

export async function signup(email: string, password: string): Promise<SigninResponse> {
  return request('/api/v1/auth/user/signup', { method: 'POST', body: { email, password } });
}

export async function me(token: string): Promise<UserResponse> {
  return request('/api/v1/auth/user/me', { token });
}

// ---------------------------------------------------------------------------
// Health / Version (v1)
// ---------------------------------------------------------------------------

export async function health(): Promise<unknown> {
  return request('/api/v1/health');
}

export async function version(): Promise<unknown> {
  return request('/api/v1/version');
}

// ---------------------------------------------------------------------------
// Workspaces (v3)
// ---------------------------------------------------------------------------

export async function listWorkspaces(token: string): Promise<{ list: Workspace[] }> {
  return request('/api/v3/meta/workspaces', { token });
}

export async function createWorkspace(token: string, title: string): Promise<Workspace> {
  return request('/api/v3/meta/workspaces', { method: 'POST', token, body: { title } });
}

export async function getWorkspace(token: string, id: string): Promise<Workspace> {
  return request(`/api/v3/meta/workspaces/${id}`, { token });
}

export async function updateWorkspace(token: string, id: string, data: Record<string, unknown>): Promise<unknown> {
  return request(`/api/v3/meta/workspaces/${id}`, { method: 'PATCH', token, body: data });
}

export async function deleteWorkspace(token: string, id: string): Promise<unknown> {
  return request(`/api/v3/meta/workspaces/${id}`, { method: 'DELETE', token });
}

// ---------------------------------------------------------------------------
// Workspace Users (v1 for list, v3 for invite)
// ---------------------------------------------------------------------------

export async function listWorkspaceUsers(
  token: string,
  wsId: string,
): Promise<{ list: WorkspaceUser[] }> {
  // No v3 GET list endpoint for workspace members — use v1
  return request(`/api/v1/workspaces/${wsId}/users`, { token });
}

export async function inviteToWorkspace(
  token: string,
  wsId: string,
  email: string,
  role: string,
): Promise<unknown> {
  return request(`/api/v3/meta/workspaces/${wsId}/members`, {
    method: 'POST',
    token,
    body: [{ email, workspace_role: role }],
  });
}

export async function updateWorkspaceMember(
  token: string,
  wsId: string,
  userId: string,
  role: string,
): Promise<unknown> {
  return request(`/api/v3/meta/workspaces/${wsId}/members`, {
    method: 'PATCH',
    token,
    body: { user_id: userId, workspace_role: role },
  });
}

export async function removeWorkspaceMember(
  token: string,
  wsId: string,
  userId: string,
): Promise<unknown> {
  return request(`/api/v3/meta/workspaces/${wsId}/members`, {
    method: 'DELETE',
    token,
    body: { user_id: userId },
  });
}

// ---------------------------------------------------------------------------
// Bases (v3)
// ---------------------------------------------------------------------------

export async function listBases(token: string, wsId: string): Promise<{ list: Base[] }> {
  return request(`/api/v3/meta/workspaces/${wsId}/bases`, { token });
}

export async function createBase(token: string, wsId: string, title: string): Promise<Base> {
  return request(`/api/v3/meta/workspaces/${wsId}/bases`, {
    method: 'POST',
    token,
    body: { title },
  });
}

export async function getBase(token: string, baseId: string): Promise<Base> {
  return request(`/api/v3/meta/bases/${baseId}`, { token });
}

export async function updateBase(
  token: string,
  baseId: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}`, { method: 'PATCH', token, body: data });
}

export async function deleteBase(token: string, baseId: string): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}`, { method: 'DELETE', token });
}

// ---------------------------------------------------------------------------
// Base Members (v3 — EE)
// ---------------------------------------------------------------------------

export async function inviteBaseMember(
  token: string,
  baseId: string,
  email: string,
  role: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/members`, {
    method: 'POST',
    token,
    body: [{ email, base_role: role }],
  });
}

export async function updateBaseMember(
  token: string,
  baseId: string,
  userId: string,
  role: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/members`, {
    method: 'PATCH',
    token,
    body: { user_id: userId, base_role: role },
  });
}

export async function removeBaseMember(
  token: string,
  baseId: string,
  userId: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/members`, {
    method: 'DELETE',
    token,
    body: { user_id: userId },
  });
}

// ---------------------------------------------------------------------------
// Tables (v3)
// ---------------------------------------------------------------------------

export async function listTables(token: string, baseId: string): Promise<{ list: Table[] }> {
  return request(`/api/v3/meta/bases/${baseId}/tables`, { token });
}

export async function createTable(
  token: string,
  baseId: string,
  title: string,
  fields: Array<{ title: string; type: string; [k: string]: unknown }>,
): Promise<Table> {
  return request(`/api/v3/meta/bases/${baseId}/tables`, {
    method: 'POST',
    token,
    body: { title, fields },
  });
}

export async function getTable(token: string, baseId: string, tableId: string): Promise<Table> {
  return request(`/api/v3/meta/bases/${baseId}/tables/${tableId}`, { token });
}

export async function updateTable(
  token: string,
  baseId: string,
  tableId: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/tables/${tableId}`, {
    method: 'PATCH',
    token,
    body: data,
  });
}

export async function deleteTable(token: string, baseId: string, tableId: string): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/tables/${tableId}`, { method: 'DELETE', token });
}

// ---------------------------------------------------------------------------
// Fields / Columns (v3)
// ---------------------------------------------------------------------------

export async function listFields(token: string, baseId: string, tableId: string): Promise<Column[]> {
  const table = await getTable(token, baseId, tableId);
  return table.fields || table.columns || [];
}

export async function getField(token: string, baseId: string, fieldId: string): Promise<Column> {
  return request(`/api/v3/meta/bases/${baseId}/fields/${fieldId}`, { token });
}

export async function createField(
  token: string,
  baseId: string,
  tableId: string,
  field: { title: string; type: string; [k: string]: unknown },
): Promise<Column> {
  return request(`/api/v3/meta/bases/${baseId}/tables/${tableId}/fields`, {
    method: 'POST',
    token,
    body: field,
  });
}

export async function updateField(
  token: string,
  baseId: string,
  fieldId: string,
  field: Record<string, unknown>,
): Promise<Column> {
  return request(`/api/v3/meta/bases/${baseId}/fields/${fieldId}`, {
    method: 'PATCH',
    token,
    body: field,
  });
}

export async function deleteField(token: string, baseId: string, fieldId: string): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/fields/${fieldId}`, { method: 'DELETE', token });
}

// ---------------------------------------------------------------------------
// Views (v3)
// ---------------------------------------------------------------------------

const VALID_VIEW_TYPES = ['grid', 'form', 'gallery', 'kanban', 'calendar', 'map'];

export async function listViews(
  token: string,
  baseId: string,
  tableId: string,
): Promise<{ list: View[] }> {
  return request(`/api/v3/meta/bases/${baseId}/tables/${tableId}/views`, { token });
}

export async function createView(
  token: string,
  baseId: string,
  tableId: string,
  title: string,
  type: string = 'grid',
): Promise<View> {
  if (!VALID_VIEW_TYPES.includes(type)) {
    throw new Error(`Unknown view type: ${type}. Use: ${VALID_VIEW_TYPES.join(', ')}`);
  }
  return request(`/api/v3/meta/bases/${baseId}/tables/${tableId}/views`, {
    method: 'POST',
    token,
    body: { title, type },
  });
}

export async function getView(token: string, baseId: string, viewId: string): Promise<View> {
  return request(`/api/v3/meta/bases/${baseId}/views/${viewId}`, { token });
}

export async function updateView(
  token: string,
  baseId: string,
  viewId: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/views/${viewId}`, {
    method: 'PATCH',
    token,
    body: data,
  });
}

export async function deleteView(token: string, baseId: string, viewId: string): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/views/${viewId}`, { method: 'DELETE', token });
}

// ---------------------------------------------------------------------------
// View Columns (v3)
// ---------------------------------------------------------------------------

export async function listViewColumns(token: string, viewId: string): Promise<unknown> {
  return request(`/api/v3/meta/views/${viewId}/columns`, { token });
}

export async function updateViewColumns(
  token: string,
  viewId: string,
  data: unknown,
): Promise<unknown> {
  return request(`/api/v3/meta/views/${viewId}/columns`, {
    method: 'PATCH',
    token,
    body: data,
  });
}

// ---------------------------------------------------------------------------
// Filters (v3)
// ---------------------------------------------------------------------------

export async function listFilters(
  token: string,
  baseId: string,
  viewId: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/views/${viewId}/filters`, { token });
}

export async function createFilter(
  token: string,
  baseId: string,
  viewId: string,
  filter: unknown,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/views/${viewId}/filters`, {
    method: 'POST',
    token,
    body: filter,
  });
}

export async function updateFilter(
  token: string,
  baseId: string,
  viewId: string,
  filter: unknown,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/views/${viewId}/filters`, {
    method: 'PATCH',
    token,
    body: filter,
  });
}

export async function replaceFilters(
  token: string,
  baseId: string,
  viewId: string,
  filters: unknown,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/views/${viewId}/filters`, {
    method: 'PUT',
    token,
    body: filters,
  });
}

export async function deleteFilter(
  token: string,
  baseId: string,
  viewId: string,
  filterId: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/views/${viewId}/filters`, {
    method: 'DELETE',
    token,
    body: { id: filterId },
  });
}

// ---------------------------------------------------------------------------
// Sorts (v3)
// ---------------------------------------------------------------------------

export async function listSorts(
  token: string,
  baseId: string,
  viewId: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/views/${viewId}/sorts`, { token });
}

export async function createSort(
  token: string,
  baseId: string,
  viewId: string,
  sort: { field_id: string; direction?: 'asc' | 'desc' },
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/views/${viewId}/sorts`, {
    method: 'POST',
    token,
    body: sort,
  });
}

export async function updateSort(
  token: string,
  baseId: string,
  viewId: string,
  sort: { id: string; field_id?: string; direction?: 'asc' | 'desc' },
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/views/${viewId}/sorts`, {
    method: 'PATCH',
    token,
    body: sort,
  });
}

export async function deleteSort(
  token: string,
  baseId: string,
  viewId: string,
  sortId: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/views/${viewId}/sorts`, {
    method: 'DELETE',
    token,
    body: { id: sortId },
  });
}

// ---------------------------------------------------------------------------
// Comments (v3)
// ---------------------------------------------------------------------------

export async function listComments(
  token: string,
  baseId: string,
  tableId: string,
  rowId: string | number,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/tables/${tableId}/records/${rowId}/comments`, {
    token,
  });
}

export async function createComment(
  token: string,
  baseId: string,
  tableId: string,
  rowId: string | number,
  comment: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/tables/${tableId}/records/${rowId}/comments`, {
    method: 'POST',
    token,
    body: { comment },
  });
}

export async function updateComment(
  token: string,
  baseId: string,
  commentId: string,
  comment: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/comment/${commentId}`, {
    method: 'PATCH',
    token,
    body: { comment },
  });
}

export async function deleteComment(
  token: string,
  baseId: string,
  commentId: string,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/comment/${commentId}`, {
    method: 'DELETE',
    token,
  });
}

// ---------------------------------------------------------------------------
// Links (v3) — uses /api/v3/data/:base/:table/links
// ---------------------------------------------------------------------------

export async function listLinks(
  token: string,
  base: string,
  table: string,
  columnId: string,
  rowId: string | number,
  params?: { limit?: number; offset?: number },
): Promise<unknown> {
  return request(`/api/v3/data/${base}/${table}/links/${columnId}/${rowId}`, {
    token,
    params: params as Record<string, string | number | undefined>,
  });
}

export async function linkRecords(
  token: string,
  base: string,
  table: string,
  columnId: string,
  rowId: string | number,
  ids: (string | number)[],
): Promise<unknown> {
  return request(`/api/v3/data/${base}/${table}/links/${columnId}/${rowId}`, {
    method: 'POST',
    token,
    body: ids,
  });
}

export async function unlinkRecords(
  token: string,
  base: string,
  table: string,
  columnId: string,
  rowId: string | number,
  ids: (string | number)[],
): Promise<unknown> {
  return request(`/api/v3/data/${base}/${table}/links/${columnId}/${rowId}`, {
    method: 'DELETE',
    token,
    body: ids,
  });
}

// ---------------------------------------------------------------------------
// Attachment Upload (v3)
// ---------------------------------------------------------------------------

export async function uploadAttachment(
  token: string,
  base: string,
  table: string,
  recordId: string | number,
  columnId: string,
  data: { contentType: string; file: string; filename: string },
): Promise<unknown> {
  return request(`/api/v3/data/${base}/${table}/records/${recordId}/fields/${columnId}/upload`, {
    method: 'POST',
    token,
    body: data,
  });
}

// ---------------------------------------------------------------------------
// API Tokens (v1)
// ---------------------------------------------------------------------------

export async function listTokens(token: string): Promise<unknown> {
  return request('/api/v1/tokens', { token });
}

export async function createToken(token: string, title: string): Promise<unknown> {
  return request('/api/v1/tokens', { method: 'POST', token, body: { description: title } });
}

export async function deleteToken(token: string, tokenId: string): Promise<unknown> {
  return request(`/api/v1/tokens/${tokenId}`, { method: 'DELETE', token });
}

// ---------------------------------------------------------------------------
// Scripts (v3 — EE)
// ---------------------------------------------------------------------------

export async function listScripts(token: string, baseId: string): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/scripts`, { token });
}

export async function getScript(token: string, baseId: string, scriptId: string): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/scripts/${scriptId}`, { token });
}

export async function createScript(
  token: string,
  baseId: string,
  script: Record<string, unknown>,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/scripts`, {
    method: 'POST',
    token,
    body: script,
  });
}

export async function updateScript(
  token: string,
  baseId: string,
  scriptId: string,
  script: Record<string, unknown>,
): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/scripts/${scriptId}`, {
    method: 'PATCH',
    token,
    body: script,
  });
}

export async function deleteScript(token: string, baseId: string, scriptId: string): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/scripts/${scriptId}`, { method: 'DELETE', token });
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
  token: string,
  base: string,
  table: string,
  params?: ListRecordsParams,
): Promise<RecordList> {
  return request(`/api/v3/data/${base}/${table}/records`, {
    token,
    params: params as Record<string, string | number | undefined>,
  });
}

export async function getRecord(
  token: string,
  base: string,
  table: string,
  rowId: string | number,
): Promise<unknown> {
  return request(`/api/v3/data/${base}/${table}/records/${rowId}`, { token });
}

export async function createRecord(
  token: string,
  base: string,
  table: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  // v3 wraps field data inside { fields: {...} }
  return request(`/api/v3/data/${base}/${table}/records`, {
    method: 'POST',
    token,
    body: { fields: data },
  });
}

export async function createRecords(
  token: string,
  base: string,
  table: string,
  data: Record<string, unknown>[],
): Promise<unknown> {
  // v3 bulk: array of { fields: {...} }
  return request(`/api/v3/data/${base}/${table}/records`, {
    method: 'POST',
    token,
    body: data.map((d) => ({ fields: d })),
  });
}

export async function updateRecord(
  token: string,
  base: string,
  table: string,
  id: string | number,
  data: Record<string, unknown>,
): Promise<unknown> {
  // v3: { id, fields: {...} }
  return request(`/api/v3/data/${base}/${table}/records`, {
    method: 'PATCH',
    token,
    body: { id, fields: data },
  });
}

export async function deleteRecord(
  token: string,
  base: string,
  table: string,
  rowId: string | number,
): Promise<unknown> {
  return request(`/api/v3/data/${base}/${table}/records`, {
    method: 'DELETE',
    token,
    body: { id: rowId },
  });
}

export async function countRecords(
  token: string,
  base: string,
  table: string,
  where?: string,
): Promise<CountResponse> {
  return request(`/api/v3/data/${base}/${table}/count`, {
    token,
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
  token: string,
  wsId: string,
  baseId: string,
  operation: string,
  opts: { method?: string; body?: unknown; params?: Record<string, string | number | string[] | undefined> } = {},
): Promise<unknown> {
  const { method = 'POST', body, params } = opts;
  return request(`/api/v2/internal/${wsId}/${baseId}`, {
    method,
    token,
    body,
    params: { operation, ...params },
  });
}

/** Internal GET shorthand */
function iGet(
  token: string, wsId: string, baseId: string, op: string,
  params?: Record<string, string | number | string[] | undefined>,
): Promise<unknown> {
  return internal(token, wsId, baseId, op, { method: 'GET', params });
}

/** Internal POST shorthand */
function iPost(
  token: string, wsId: string, baseId: string, op: string,
  body?: unknown, params?: Record<string, string | number | string[] | undefined>,
): Promise<unknown> {
  return internal(token, wsId, baseId, op, { method: 'POST', body, params });
}

// ---------------------------------------------------------------------------
// Internal: Tables & Columns
// ---------------------------------------------------------------------------

/** Get table with accessible views */
export function tableGet(token: string, wsId: string, baseId: string, tableId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'tableGet', { tableId });
}

/** Update a table (title, meta, etc.) */
export function tableUpdate(token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'tableUpdate', body, { tableId });
}

/** Delete a table */
export function tableDelete(token: string, wsId: string, baseId: string, tableId: string, opts?: { forceDeleteRelations?: boolean }): Promise<unknown> {
  return iPost(token, wsId, baseId, 'tableDelete', opts, { tableId });
}

/** Reorder a table within its base */
export function tableReorder(token: string, wsId: string, baseId: string, tableId: string, order: number): Promise<unknown> {
  return iPost(token, wsId, baseId, 'tableReorder', { order }, { tableId });
}

/** Get sample data for a table (used by hooks) */
export function tableSampleData(token: string, wsId: string, baseId: string, tableId: string, opts?: { hookOperation?: string; version?: string; event?: string }): Promise<unknown> {
  return iGet(token, wsId, baseId, 'tableSampleData', { tableId, ...opts });
}

/** Get hash of column definitions for change detection */
export function columnsHash(token: string, wsId: string, baseId: string, tableId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'columnsHash', { tableId });
}

/** Add a column to a table */
export function columnAdd(token: string, wsId: string, baseId: string, tableId: string, column: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'columnAdd', column, { tableId });
}

/** Update a column */
export function columnUpdate(token: string, wsId: string, baseId: string, columnId: string, column: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'columnUpdate', column, { columnId });
}

/** Delete a column */
export function columnDelete(token: string, wsId: string, baseId: string, columnId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'columnDelete', undefined, { columnId });
}

/** Set a column as the display/primary column */
export function columnSetAsPrimary(token: string, wsId: string, baseId: string, columnId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'columnSetAsPrimary', undefined, { columnId });
}

/** Bulk column operations (add/update/delete multiple columns) */
export function columnsBulk(token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'columnsBulk', body, { tableId });
}

// ---------------------------------------------------------------------------
// Internal: Views
// ---------------------------------------------------------------------------

/** List views for a table */
export function viewList(token: string, wsId: string, baseId: string, tableId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'viewList', { tableId });
}

/** Update a view's properties */
export function viewUpdate(token: string, wsId: string, baseId: string, viewId: string, view: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'viewUpdate', view, { viewId });
}

/** Delete a view */
export function viewDelete(token: string, wsId: string, baseId: string, viewId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'viewDelete', undefined, { viewId });
}

/** List columns for a view (includes visibility, order, width) */
export function viewColumnList(token: string, wsId: string, baseId: string, viewId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'viewColumnList', { viewId });
}

/** Update a view column (visibility, order, width) */
export function viewColumnUpdate(token: string, wsId: string, baseId: string, viewId: string, columnId: string, column: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'viewColumnUpdate', column, { viewId, columnId });
}

/** Add a column to a view */
export function viewColumnCreate(token: string, wsId: string, baseId: string, viewId: string, column: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'viewColumnCreate', column, { viewId });
}

/** Show all hidden columns in a view */
export function showAllColumns(token: string, wsId: string, baseId: string, viewId: string, ignoreIds?: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'showAllColumns', undefined, { viewId, ignoreIds });
}

/** Hide all columns in a view */
export function hideAllColumns(token: string, wsId: string, baseId: string, viewId: string, ignoreIds?: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'hideAllColumns', undefined, { viewId, ignoreIds });
}

/** Update a grid view column (width, etc.) */
export function gridColumnUpdate(token: string, wsId: string, baseId: string, gridViewColumnId: string, grid: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'gridColumnUpdate', grid, { gridViewColumnId });
}

// ---------------------------------------------------------------------------
// Internal: View Creation
// ---------------------------------------------------------------------------

/** Create a grid view */
export function gridViewCreate(token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'gridViewCreate', body, { tableId });
}

/** Create a form view */
export function formViewCreate(token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'formViewCreate', body, { tableId });
}

/** Create a gallery view */
export function galleryViewCreate(token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'galleryViewCreate', body, { tableId });
}

/** Create a kanban view */
export function kanbanViewCreate(token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'kanbanViewCreate', body, { tableId });
}

/** Create a map view */
export function mapViewCreate(token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'mapViewCreate', body, { tableId });
}

/** Create a calendar view */
export function calendarViewCreate(token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'calendarViewCreate', body, { tableId });
}

// ---------------------------------------------------------------------------
// Internal: View Configs
// ---------------------------------------------------------------------------

/** Get form view config */
export function formViewGet(token: string, wsId: string, baseId: string, formViewId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'formViewGet', { formViewId });
}

/** Update form view config */
export function formViewUpdate(token: string, wsId: string, baseId: string, viewId: string, form: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'formViewUpdate', form, { viewId });
}

/** Update a form column */
export function formColumnUpdate(token: string, wsId: string, baseId: string, formColumnId: string, column: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'formColumnUpdate', column, { formColumnId });
}

/** Update gallery view config */
export function galleryViewUpdate(token: string, wsId: string, baseId: string, viewId: string, gallery: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'galleryViewUpdate', gallery, { viewId });
}

/** Update kanban view config */
export function kanbanViewUpdate(token: string, wsId: string, baseId: string, viewId: string, kanban: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'kanbanViewUpdate', kanban, { viewId });
}

/** Update grid view config */
export function gridViewUpdate(token: string, wsId: string, baseId: string, viewId: string, grid: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'gridViewUpdate', grid, { viewId });
}

/** Get map view config */
export function mapViewGet(token: string, wsId: string, baseId: string, mapViewId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'mapViewGet', { mapViewId });
}

/** Update map view config */
export function mapViewUpdate(token: string, wsId: string, baseId: string, viewId: string, map: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'mapViewUpdate', map, { viewId });
}

/** Update calendar view config */
export function calendarViewUpdate(token: string, wsId: string, baseId: string, viewId: string, calendar: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'calendarViewUpdate', calendar, { viewId });
}

// ---------------------------------------------------------------------------
// Internal: Row Colors
// ---------------------------------------------------------------------------

/** Get row color configuration for a view */
export function viewRowColorInfo(token: string, wsId: string, baseId: string, viewId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'viewRowColorInfo', { viewId });
}

/** Add a row color condition */
export function viewRowColorConditionAdd(token: string, wsId: string, baseId: string, viewId: string, body: { color: string; is_set_as_background?: boolean; nc_order?: number; filter?: unknown }): Promise<unknown> {
  return iPost(token, wsId, baseId, 'viewRowColorConditionAdd', body, { viewId });
}

/** Update a row color condition */
export function viewRowColorConditionUpdate(token: string, wsId: string, baseId: string, viewId: string, rowColorConditionId: string, body: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'viewRowColorConditionUpdate', body, { viewId, rowColorConditionId });
}

/** Delete a row color condition */
export function viewRowColorConditionDelete(token: string, wsId: string, baseId: string, viewId: string, rowColorConditionId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'viewRowColorConditionDelete', undefined, { viewId, rowColorConditionId });
}

/** Set row color by a select field */
export function viewRowColorSelectAdd(token: string, wsId: string, baseId: string, viewId: string, body: { fk_column_id: string; is_set_as_background?: boolean }): Promise<unknown> {
  return iPost(token, wsId, baseId, 'viewRowColorSelectAdd', body, { viewId });
}

/** Remove all row color info from a view */
export function viewRowColorInfoDelete(token: string, wsId: string, baseId: string, viewId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'viewRowColorInfoDelete', undefined, { viewId });
}

// ---------------------------------------------------------------------------
// Internal: Filters
// ---------------------------------------------------------------------------

/** List filters for a view */
export function iFilterList(token: string, wsId: string, baseId: string, viewId: string, includeAllFilters?: boolean): Promise<unknown> {
  return iGet(token, wsId, baseId, 'filterList', { viewId, includeAllFilters: includeAllFilters ? 'true' : undefined });
}

/** List children of a filter group */
export function filterChildrenList(token: string, wsId: string, baseId: string, filterId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'filterChildrenList', { filterId });
}

/** Create a filter on a view */
export function iFilterCreate(token: string, wsId: string, baseId: string, viewId: string, filter: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'filterCreate', filter, { viewId });
}

/** Update a filter */
export function iFilterUpdate(token: string, wsId: string, baseId: string, filterId: string, filter: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'filterUpdate', filter, { filterId });
}

/** Delete a filter */
export function iFilterDelete(token: string, wsId: string, baseId: string, filterId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'filterDelete', undefined, { filterId });
}

// ---------------------------------------------------------------------------
// Internal: Sorts
// ---------------------------------------------------------------------------

/** List sorts for a view */
export function iSortList(token: string, wsId: string, baseId: string, viewId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'sortList', { viewId });
}

/** Create a sort on a view */
export function iSortCreate(token: string, wsId: string, baseId: string, viewId: string, sort: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'sortCreate', sort, { viewId });
}

/** Update a sort */
export function iSortUpdate(token: string, wsId: string, baseId: string, sortId: string, sort: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'sortUpdate', sort, { sortId });
}

/** Delete a sort */
export function iSortDelete(token: string, wsId: string, baseId: string, sortId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'sortDelete', undefined, { sortId });
}

// ---------------------------------------------------------------------------
// Internal: Hooks
// ---------------------------------------------------------------------------

/** List hooks for a table */
export function hookList(token: string, wsId: string, baseId: string, tableId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'hookList', { tableId });
}

/** Create a hook on a table */
export function hookCreate(token: string, wsId: string, baseId: string, tableId: string, hook: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'hookCreate', hook, { tableId });
}

/** Update a hook */
export function hookUpdate(token: string, wsId: string, baseId: string, hookId: string, hook: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'hookUpdate', hook, { hookId });
}

/** Delete a hook */
export function hookDelete(token: string, wsId: string, baseId: string, hookId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'hookDelete', undefined, { hookId });
}

/** Test a hook by sending a sample payload */
export function hookTest(token: string, wsId: string, baseId: string, tableId: string, hookTest: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'hookTest', hookTest, { tableId });
}

/** Trigger a hook for a specific row */
export function hookTrigger(token: string, wsId: string, baseId: string, hookId: string, rowId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'hookTrigger', undefined, { hookId, rowId });
}

/** List hook execution logs */
export function hookLogList(token: string, wsId: string, baseId: string, hookId: string, params?: { limit?: number; offset?: number }): Promise<unknown> {
  return iGet(token, wsId, baseId, 'hookLogList', { hookId, ...params });
}

/** List filters attached to a hook */
export function hookFilterList(token: string, wsId: string, baseId: string, hookId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'hookFilterList', { hookId });
}

/** Create a filter on a hook */
export function hookFilterCreate(token: string, wsId: string, baseId: string, hookId: string, filter: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'hookFilterCreate', filter, { hookId });
}

/** Get sample payload for hook testing */
export function hookSamplePayload(token: string, wsId: string, baseId: string, tableId: string, opts?: { hookOperation?: string; version?: string; event?: string }): Promise<unknown> {
  return iGet(token, wsId, baseId, 'hookSamplePayload', { tableId, ...opts });
}

// ---------------------------------------------------------------------------
// Internal: Shared Views
// ---------------------------------------------------------------------------

/** Create a shared view (makes a view publicly accessible via UUID) */
export function shareViewCreate(token: string, wsId: string, baseId: string, viewId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'shareView', undefined, { viewId });
}

/** Update shared view settings (password, etc.) */
export function shareViewUpdate(token: string, wsId: string, baseId: string, viewId: string, sharedView: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'shareViewUpdate', sharedView, { viewId });
}

/** Delete a shared view (revoke public access) */
export function shareViewDelete(token: string, wsId: string, baseId: string, viewId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'shareViewDelete', undefined, { viewId });
}

// ---------------------------------------------------------------------------
// Internal: Data Operations
// ---------------------------------------------------------------------------

/** List records from a table/view (internal path, supports server caching) */
export function dataList(token: string, wsId: string, baseId: string, tableId: string, opts?: { viewId?: string; limit?: number; offset?: number; where?: string; sort?: string; fields?: string; includeSortAndFilterColumns?: boolean }): Promise<unknown> {
  const { includeSortAndFilterColumns, ...rest } = opts || {};
  return iGet(token, wsId, baseId, 'dataList', {
    tableId,
    includeSortAndFilterColumns: includeSortAndFilterColumns ? 'true' : undefined,
    ...rest,
  });
}

/** Insert a single record */
export function dataInsert(token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>, opts?: { viewId?: string; undo?: boolean }): Promise<unknown> {
  return iPost(token, wsId, baseId, 'dataInsert', body, { tableId, viewId: opts?.viewId, undo: opts?.undo ? 'true' : undefined });
}

/** Update a record */
export function dataUpdate(token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>, opts?: { viewId?: string }): Promise<unknown> {
  return iPost(token, wsId, baseId, 'dataUpdate', body, { tableId, viewId: opts?.viewId });
}

/** Delete a record */
export function dataDelete(token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>, opts?: { viewId?: string }): Promise<unknown> {
  return iPost(token, wsId, baseId, 'dataDelete', body, { tableId, viewId: opts?.viewId });
}

/** Export view data as CSV/JSON (returns a job) */
export function dataExport(token: string, wsId: string, baseId: string, viewId: string, exportAs: string, options?: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'dataExport', { exportAs, options }, { viewId });
}

/** Aggregate data for a table/view (count, sum, avg, etc.) */
export function dataAggregate(token: string, wsId: string, baseId: string, tableId: string, opts?: { viewId?: string; [k: string]: unknown }): Promise<unknown> {
  return iGet(token, wsId, baseId, 'dataAggregate', { tableId, ...opts });
}

/** Bulk data list with POST body config */
export function bulkDataList(token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>, opts?: { viewId?: string }): Promise<unknown> {
  return iPost(token, wsId, baseId, 'bulkDataList', body, { tableId, viewId: opts?.viewId });
}

/** Bulk aggregate with POST body config */
export function bulkAggregate(token: string, wsId: string, baseId: string, tableId: string, body: Record<string, unknown>, opts?: { viewId?: string }): Promise<unknown> {
  return iPost(token, wsId, baseId, 'bulkAggregate', body, { tableId, viewId: opts?.viewId });
}

/** Bulk delete all matching records */
export function bulkDataDeleteAll(token: string, wsId: string, baseId: string, tableId: string, opts?: { viewId?: string; where?: string }): Promise<unknown> {
  return iPost(token, wsId, baseId, 'bulkDataDeleteAll', undefined, { tableId, ...opts });
}

// ---------------------------------------------------------------------------
// Internal: Nested / Linked Data
// ---------------------------------------------------------------------------

/** List nested (linked) records for a row+column */
export function nestedDataList(token: string, wsId: string, baseId: string, tableId: string, rowId: string, columnId: string, opts?: { viewId?: string; limit?: number; offset?: number }): Promise<unknown> {
  return iGet(token, wsId, baseId, 'nestedDataList', { tableId, rowId, columnId, ...opts });
}

/** Link records in a link column */
export function nestedDataLink(token: string, wsId: string, baseId: string, tableId: string, rowId: string, columnId: string, refRowIds: unknown[], opts?: { viewId?: string }): Promise<unknown> {
  return iPost(token, wsId, baseId, 'nestedDataLink', refRowIds, { tableId, rowId, columnId, viewId: opts?.viewId });
}

/** Unlink records from a link column */
export function nestedDataUnlink(token: string, wsId: string, baseId: string, tableId: string, rowId: string, columnId: string, refRowIds: unknown[], opts?: { viewId?: string }): Promise<unknown> {
  return iPost(token, wsId, baseId, 'nestedDataUnlink', refRowIds, { tableId, rowId, columnId, viewId: opts?.viewId });
}

/** Copy/paste or delete all linked data for a column */
export function nestedDataListCopyPasteOrDeleteAll(token: string, wsId: string, baseId: string, tableId: string, columnId: string, data: unknown, opts?: { viewId?: string }): Promise<unknown> {
  return iPost(token, wsId, baseId, 'nestedDataListCopyPasteOrDeleteAll', data, { tableId, columnId, viewId: opts?.viewId });
}

/** List linked records for a link column (with caching) */
export function linkDataList(token: string, wsId: string, baseId: string, columnId: string, opts?: { tableId?: string; viewId?: string; rowId?: string; limit?: number; offset?: number }): Promise<unknown> {
  return iGet(token, wsId, baseId, 'linkDataList', { columnId, ...opts });
}

// ---------------------------------------------------------------------------
// Internal: Comments
// ---------------------------------------------------------------------------

/** List comments for a row */
export function commentList(token: string, wsId: string, baseId: string, fk_model_id: string, row_id: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'commentList', { fk_model_id, row_id });
}

/** Get comment counts for multiple rows. Pass row IDs as array. */
export function commentCount(token: string, wsId: string, baseId: string, fk_model_id: string, ids: string[]): Promise<unknown> {
  return iGet(token, wsId, baseId, 'commentCount', { fk_model_id, ids });
}

/** Add a comment to a row */
export function commentRow(token: string, wsId: string, baseId: string, body: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'commentRow', body);
}

/** Update a comment */
export function iCommentUpdate(token: string, wsId: string, baseId: string, commentId: string, body: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'commentUpdate', { commentId, ...body });
}

/** Delete a comment */
export function iCommentDelete(token: string, wsId: string, baseId: string, commentId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'commentDelete', { commentId });
}

/** Resolve a comment (EE) */
export function commentResolve(token: string, wsId: string, baseId: string, commentId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'commentResolve', { commentId });
}

// ---------------------------------------------------------------------------
// Internal: Extensions
// ---------------------------------------------------------------------------

/** List extensions for the base */
export function extensionList(token: string, wsId: string, baseId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'extensionList');
}

/** Get a single extension by ID */
export function extensionRead(token: string, wsId: string, baseId: string, extensionId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'extensionRead', { extensionId });
}

/** Create an extension */
export function extensionCreate(token: string, wsId: string, baseId: string, extension: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'extensionCreate', extension);
}

/** Update an extension */
export function extensionUpdate(token: string, wsId: string, baseId: string, extensionId: string, extension: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'extensionUpdate', extension, { extensionId });
}

/** Delete an extension */
export function extensionDelete(token: string, wsId: string, baseId: string, extensionId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'extensionDelete', undefined, { extensionId });
}

// ---------------------------------------------------------------------------
// Internal: Sync Sources
// ---------------------------------------------------------------------------

/** List sync sources for a base */
export function syncSourceList(token: string, wsId: string, baseId: string, sourceId?: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'syncSourceList', sourceId ? { sourceId } : undefined);
}

/** Create a sync source */
export function syncSourceCreate(token: string, wsId: string, baseId: string, sourceId: string, payload: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'syncSourceCreate', payload, { sourceId });
}

/** Update a sync source */
export function syncSourceUpdate(token: string, wsId: string, baseId: string, syncId: string, payload: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'syncSourceUpdate', payload, { syncId });
}

/** Delete a sync source */
export function syncSourceDelete(token: string, wsId: string, baseId: string, syncId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'syncSourceDelete', undefined, { syncId });
}

/** Trigger an Airtable import job */
export function atImportTrigger(token: string, wsId: string, baseId: string, syncId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'atImportTrigger', undefined, { syncId });
}

// ---------------------------------------------------------------------------
// Internal: Dependencies & Audit
// ---------------------------------------------------------------------------

/** Check dependencies before deleting an entity */
export function checkDependency(token: string, wsId: string, baseId: string, body: { entityType: string; entityId: string }): Promise<unknown> {
  return iPost(token, wsId, baseId, 'checkDependency', body);
}

/** List audit trail for a record */
export function recordAuditList(token: string, wsId: string, baseId: string, fk_model_id: string, row_id: string, cursor?: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'recordAuditList', { fk_model_id, row_id, cursor });
}

// ---------------------------------------------------------------------------
// Internal: MCP Tokens
// ---------------------------------------------------------------------------

/** List MCP tokens for the base */
export function mcpList(token: string, wsId: string, baseId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'mcpList');
}

/** Get a single MCP token */
export function mcpGet(token: string, wsId: string, baseId: string, tokenId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'mcpGet', { tokenId });
}

/** List all MCP tokens for the current user (org-scoped) */
export function mcpRootList(token: string, wsId: string, baseId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'mcpRootList');
}

/** Create an MCP token */
export function mcpCreate(token: string, wsId: string, baseId: string, body: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'mcpCreate', body);
}

/** Update (regenerate) an MCP token */
export function mcpUpdate(token: string, wsId: string, baseId: string, tokenId: string, body: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'mcpUpdate', { tokenId, ...body });
}

/** Delete an MCP token */
export function mcpDelete(token: string, wsId: string, baseId: string, tokenId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'mcpDelete', { tokenId });
}

// ---------------------------------------------------------------------------
// Internal: OAuth Clients (org-scoped)
// ---------------------------------------------------------------------------

/** List OAuth clients */
export function oAuthClientList(token: string, wsId: string, baseId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'oAuthClientList');
}

/** Get an OAuth client by ID */
export function oAuthClientGet(token: string, wsId: string, baseId: string, clientId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'oAuthClientGet', { clientId });
}

/** Create an OAuth client */
export function oAuthClientCreate(token: string, wsId: string, baseId: string, body: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'oAuthClientCreate', body);
}

/** Update an OAuth client */
export function oAuthClientUpdate(token: string, wsId: string, baseId: string, clientId: string, body: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'oAuthClientUpdate', body, { clientId });
}

/** Delete an OAuth client */
export function oAuthClientDelete(token: string, wsId: string, baseId: string, clientId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'oAuthClientDelete', undefined, { clientId });
}

/** Regenerate an OAuth client secret */
export function oAuthClientRegenerateSecret(token: string, wsId: string, baseId: string, clientId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'oAuthClientRegenerateSecret', undefined, { clientId });
}

/** List OAuth authorizations for the current user */
export function oAuthAuthorizationList(token: string, wsId: string, baseId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'oAuthAuthorizationList');
}

/** Revoke an OAuth authorization */
export function oAuthAuthorizationRevoke(token: string, wsId: string, baseId: string, tokenId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'oAuthAuthorizationRevoke', { tokenId });
}

// ---------------------------------------------------------------------------
// Internal: EE Filters (link/widget/rowColor)
// ---------------------------------------------------------------------------

/** List filters for a link column (EE) */
export function linkFilterList(token: string, wsId: string, baseId: string, columnId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'linkFilterList', { columnId });
}

/** List filters for a widget (EE) */
export function widgetFilterList(token: string, wsId: string, baseId: string, widgetId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'widgetFilterList', { widgetId });
}

/** Create a filter on a link column (EE) */
export function linkFilterCreate(token: string, wsId: string, baseId: string, columnId: string, filter: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'linkFilterCreate', filter, { columnId });
}

/** Create a filter on a widget (EE) */
export function widgetFilterCreate(token: string, wsId: string, baseId: string, widgetId: string, filter: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'widgetFilterCreate', filter, { widgetId });
}

/** Create a filter on a row color condition (EE) */
export function rowColorConditionsFilterCreate(token: string, wsId: string, baseId: string, rowColorConditionId: string, filter: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'rowColorConditionsFilterCreate', filter, { rowColorConditionId });
}

// ---------------------------------------------------------------------------
// Internal: Workflows (EE)
// ---------------------------------------------------------------------------

/** List workflows for the base */
export function workflowList(token: string, wsId: string, baseId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'workflowList');
}

/** Get a single workflow */
export function workflowGet(token: string, wsId: string, baseId: string, workflowId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'workflowGet', { workflowId });
}

/** List workflow executions */
export function workflowExecutionList(token: string, wsId: string, baseId: string, workflowId: string, opts?: { limit?: number; offset?: number }): Promise<unknown> {
  return iGet(token, wsId, baseId, 'workflowExecutionList', { workflowId, ...opts });
}

/** Get a single workflow execution */
export function workflowExecutionGet(token: string, wsId: string, baseId: string, workflowId: string, executionId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'workflowExecutionGet', { workflowId, executionId });
}

/** Get available workflow node types */
export function workflowNodes(token: string, wsId: string, baseId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'workflowNodes');
}

/** List workflow subscribers */
export function workflowListSubscribers(token: string, wsId: string, baseId: string, workflowId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'workflowListSubscribers', { workflowId });
}

/** Create a workflow */
export function workflowCreate(token: string, wsId: string, baseId: string, body: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'workflowCreate', body);
}

/** Update a workflow */
export function workflowUpdate(token: string, wsId: string, baseId: string, workflowId: string, body: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'workflowUpdate', { workflowId, ...body });
}

/** Delete a workflow */
export function workflowDelete(token: string, wsId: string, baseId: string, workflowId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'workflowDelete', { workflowId });
}

/** Duplicate a workflow */
export function workflowDuplicate(token: string, wsId: string, baseId: string, workflowId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'workflowDuplicate', { workflowId });
}

/** Execute a workflow */
export function workflowExecute(token: string, wsId: string, baseId: string, workflowId: string, body?: { triggerData?: unknown; triggerNodeTitle?: string }): Promise<unknown> {
  return iPost(token, wsId, baseId, 'workflowExecute', { workflowId, ...body });
}

/** Fetch integration options for a workflow node */
export function workflowNodeIntegrationFetchOptions(token: string, wsId: string, baseId: string, body: { integration: string; key: string }): Promise<unknown> {
  return iPost(token, wsId, baseId, 'workflowNodeIntegrationFetchOptions', body);
}

/** Test a workflow node */
export function workflowTestNode(token: string, wsId: string, baseId: string, body: { workflowId: string; nodeId: string; testTriggerData?: unknown; testMode?: string }): Promise<unknown> {
  return iPost(token, wsId, baseId, 'workflowTestNode', body);
}

/** Publish a workflow */
export function workflowPublish(token: string, wsId: string, baseId: string, workflowId: string, cancelPendingExecutions?: boolean): Promise<unknown> {
  return iPost(token, wsId, baseId, 'workflowPublish', { workflowId, cancelPendingExecutions });
}

/** Add subscribers to a workflow */
export function workflowAddSubscribers(token: string, wsId: string, baseId: string, workflowId: string, userIds: string[]): Promise<unknown> {
  return iPost(token, wsId, baseId, 'workflowAddSubscribers', { workflowId, userIds });
}

/** Remove a subscriber from a workflow */
export function workflowRemoveSubscriber(token: string, wsId: string, baseId: string, subscriberId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'workflowRemoveSubscriber', { subscriberId });
}

// ---------------------------------------------------------------------------
// Internal: Managed Apps (EE)
// ---------------------------------------------------------------------------

/** List published apps in the store */
export function managedAppStoreList(token: string, wsId: string, baseId: string, opts?: { category?: string; search?: string; limit?: number; offset?: number }): Promise<unknown> {
  return iGet(token, wsId, baseId, 'managedAppStoreList', opts as Record<string, string | number | undefined>);
}

/** List managed apps in the workspace */
export function managedAppList(token: string, wsId: string, baseId: string, opts?: { limit?: number; offset?: number }): Promise<unknown> {
  return iGet(token, wsId, baseId, 'managedAppList', opts as Record<string, string | number | undefined>);
}

/** Get a single managed app */
export function managedAppGet(token: string, wsId: string, baseId: string, managedAppId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'managedAppGet', { managedAppId });
}

/** Get updates available for an installed managed app */
export function managedAppGetUpdates(token: string, wsId: string, baseId: string, managedAppId: string, installedBaseId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'managedAppGetUpdates', { managedAppId, installedBaseId });
}

/** List versions of a managed app */
export function managedAppVersionsList(token: string, wsId: string, baseId: string, managedAppId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'managedAppVersionsList', { managedAppId });
}

/** Get deployment statistics for a managed app (owner only) */
export function managedAppDeployments(token: string, wsId: string, baseId: string, managedAppId: string): Promise<unknown> {
  return iGet(token, wsId, baseId, 'managedAppDeployments', { managedAppId });
}

/** Get deployments for a specific version (owner only) */
export function managedAppVersionDeployments(token: string, wsId: string, baseId: string, managedAppId: string, versionId: string, opts?: { limit?: number; offset?: number }): Promise<unknown> {
  return iGet(token, wsId, baseId, 'managedAppVersionDeployments', { managedAppId, versionId, ...opts });
}

/** Get deployment logs for a base (owner only) */
export function managedAppDeploymentLogs(token: string, wsId: string, baseId: string, logsBaseId: string, opts?: { limit?: number; offset?: number }): Promise<unknown> {
  return iGet(token, wsId, baseId, 'managedAppDeploymentLogs', { baseId: logsBaseId, ...opts });
}

/** Create a managed app */
export function managedAppCreate(token: string, wsId: string, baseId: string, body: { title: string; visibility?: string; basePayload?: unknown }): Promise<unknown> {
  return iPost(token, wsId, baseId, 'managedAppCreate', body);
}

/** Update a managed app */
export function managedAppUpdate(token: string, wsId: string, baseId: string, managedAppId: string, body: Record<string, unknown>): Promise<unknown> {
  return iPost(token, wsId, baseId, 'managedAppUpdate', { managedAppId, ...body });
}

/** Delete a managed app (soft delete, owner only) */
export function managedAppDelete(token: string, wsId: string, baseId: string, managedAppId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'managedAppDelete', { managedAppId });
}

/** Publish a managed app version */
export function managedAppPublish(token: string, wsId: string, baseId: string, managedAppVersionId: string, releaseNotes?: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'managedAppPublish', { managedAppVersionId, releaseNotes });
}

/** Create a new draft version of a managed app */
export function managedAppCreateDraft(token: string, wsId: string, baseId: string, managedAppId: string, version: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'managedAppCreateDraft', { managedAppId, version });
}

/** Discard a draft version of a managed app */
export function managedAppDiscardDraft(token: string, wsId: string, baseId: string, managedAppId: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'managedAppDiscardDraft', { managedAppId });
}

/** Install a managed app into a workspace */
export function managedAppInstall(token: string, wsId: string, baseId: string, managedAppId: string, target_workspace_id: string): Promise<unknown> {
  return iPost(token, wsId, baseId, 'managedAppInstall', { managedAppId, target_workspace_id });
}

// ---------------------------------------------------------------------------
// Internal: Integration Options (EE)
// ---------------------------------------------------------------------------

/** Fetch options for an integration (dropdown values for workflow node config) */
export function integrationFetchOptions(token: string, wsId: string, baseId: string, body: { integration: string; key: string; params?: unknown }): Promise<unknown> {
  return iPost(token, wsId, baseId, 'integrationFetchOptions', body);
}

// ---------------------------------------------------------------------------
// Internal: Send Record Email (EE)
// ---------------------------------------------------------------------------

/** Send a record by email to base members */
export function sendRecordEmail(token: string, wsId: string, baseId: string, body: { tableId: string; rowId: string; emails: string[]; subject?: string; message?: string; viewId?: string; sendCopyToSelf?: boolean }): Promise<unknown> {
  return iPost(token, wsId, baseId, 'sendRecordEmail', body);
}

// ===========================================================================
// REST API Fallbacks (no internal equivalent available)
// ===========================================================================
// These use v2/v1 REST endpoints because no internal API operation exists
// for these resources. Use internal operations above when available.
// ===========================================================================

// ---------------------------------------------------------------------------
// Shared View Listing (v1) — no internal list operation available
// ---------------------------------------------------------------------------

/** List shared views for a table. Uses v1 route (no internal equivalent). baseId included for scope consistency. */
export async function listSharedViews(token: string, baseId: string, tableId: string): Promise<unknown> {
  return request(`/api/v1/db/meta/tables/${tableId}/share`, { token });
}

// ---------------------------------------------------------------------------
// Shared Bases (v2)
// ---------------------------------------------------------------------------

export async function getSharedBase(token: string, baseId: string): Promise<unknown> {
  return request(`/api/v2/meta/bases/${baseId}/shared`, { token });
}

export async function createSharedBase(token: string, baseId: string): Promise<unknown> {
  return request(`/api/v2/meta/bases/${baseId}/shared`, { method: 'POST', token });
}

export async function updateSharedBase(
  token: string,
  baseId: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  return request(`/api/v2/meta/bases/${baseId}/shared`, { method: 'PATCH', token, body: data });
}

export async function deleteSharedBase(token: string, baseId: string): Promise<unknown> {
  return request(`/api/v2/meta/bases/${baseId}/shared`, { method: 'DELETE', token });
}

// ---------------------------------------------------------------------------
// Public Shared View Data (no auth needed)
// ---------------------------------------------------------------------------

export async function getSharedViewMeta(uuid: string): Promise<unknown> {
  return request(`/api/v2/public/shared-view/${uuid}/meta`);
}

export async function getSharedViewRows(
  uuid: string,
  params?: Record<string, string | number | undefined>,
): Promise<unknown> {
  return request(`/api/v2/public/shared-view/${uuid}/rows`, { params });
}

export async function submitSharedViewRow(
  uuid: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  return request(`/api/v2/public/shared-view/${uuid}/rows`, {
    method: 'POST',
    body: data,
  });
}

// ---------------------------------------------------------------------------
// File Storage / Attachments (v2)
// ---------------------------------------------------------------------------

export async function uploadFile(
  token: string,
  filePath: string,
  params?: { path?: string },
): Promise<unknown> {
  const base = getBaseUrl().replace(/\/+$/, '');
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
  token: string,
  urls: Array<{ url: string; fileName?: string }>,
  params?: { path?: string },
): Promise<unknown> {
  return request('/api/v2/storage/upload-by-url', {
    method: 'POST',
    token,
    body: urls,
    params: params?.path ? { path: params.path } : undefined,
  });
}

// ---------------------------------------------------------------------------
// Bulk Data Operations (v1 — by table name alias)
// ---------------------------------------------------------------------------

export async function bulkInsert(
  token: string,
  base: string,
  table: string,
  records: Record<string, unknown>[],
): Promise<unknown> {
  return request(`/api/v1/db/data/bulk/noco/${base}/${table}`, {
    method: 'POST',
    token,
    body: records,
  });
}

export async function bulkUpdate(
  token: string,
  base: string,
  table: string,
  records: Array<Record<string, unknown>>,
): Promise<unknown> {
  return request(`/api/v1/db/data/bulk/noco/${base}/${table}`, {
    method: 'PATCH',
    token,
    body: records,
  });
}

export async function bulkDelete(
  token: string,
  base: string,
  table: string,
  ids: Array<Record<string, unknown>>,
): Promise<unknown> {
  return request(`/api/v1/db/data/bulk/noco/${base}/${table}`, {
    method: 'DELETE',
    token,
    body: ids,
  });
}

export async function bulkUpdateAll(
  token: string,
  base: string,
  table: string,
  body: { where?: string; fields: Record<string, unknown> },
): Promise<unknown> {
  return request(`/api/v1/db/data/bulk/noco/${base}/${table}/all`, {
    method: 'PATCH',
    token,
    body,
  });
}

export async function bulkDeleteAll(
  token: string,
  base: string,
  table: string,
  body: { where?: string },
): Promise<unknown> {
  return request(`/api/v1/db/data/bulk/noco/${base}/${table}/all`, {
    method: 'DELETE',
    token,
    body,
  });
}

// ---------------------------------------------------------------------------
// Notifications (v1)
// ---------------------------------------------------------------------------

export async function listNotifications(token: string): Promise<unknown> {
  return request('/api/v1/notifications', { token });
}

export async function markNotificationRead(
  token: string,
  notificationId: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  return request(`/api/v1/notifications/${notificationId}`, {
    method: 'PATCH',
    token,
    body: data,
  });
}

export async function deleteNotification(token: string, notificationId: string): Promise<unknown> {
  return request(`/api/v1/notifications/${notificationId}`, { method: 'DELETE', token });
}

export async function markAllNotificationsRead(token: string): Promise<unknown> {
  return request('/api/v1/notifications/mark-all-read', { method: 'POST', token });
}

// ---------------------------------------------------------------------------
// Gallery View GET (v1) — no internal GET operation
// ---------------------------------------------------------------------------

export async function getGalleryView(token: string, galleryViewId: string): Promise<unknown> {
  return request(`/api/v1/db/meta/galleries/${galleryViewId}`, { token });
}

// ---------------------------------------------------------------------------
// Kanban View GET (v1) — no internal GET operation
// ---------------------------------------------------------------------------

export async function getKanbanView(token: string, kanbanViewId: string): Promise<unknown> {
  return request(`/api/v1/db/meta/kanbans/${kanbanViewId}`, { token });
}

// ---------------------------------------------------------------------------
// Grid Columns List (v1) — for grid-specific column data
// ---------------------------------------------------------------------------

export async function listGridColumns(token: string, gridViewId: string): Promise<unknown> {
  return request(`/api/v1/db/meta/grids/${gridViewId}/grid-columns`, { token });
}

// ---------------------------------------------------------------------------
// Calendar Data (v1)
// ---------------------------------------------------------------------------

export async function calendarData(
  token: string,
  base: string,
  table: string,
  viewName: string,
  params?: Record<string, string | number | undefined>,
): Promise<unknown> {
  return request(`/api/v1/db/calendar-data/noco/${base}/${table}/views/${viewName}`, {
    token,
    params,
  });
}

export async function calendarCountByDate(
  token: string,
  base: string,
  table: string,
  viewName: string,
  params?: Record<string, string | number | undefined>,
): Promise<unknown> {
  return request(`/api/v1/db/calendar-data/noco/${base}/${table}/views/${viewName}/countByDate`, {
    token,
    params,
  });
}

// ---------------------------------------------------------------------------
// Base Users / Collaborators (v1)
// ---------------------------------------------------------------------------

export async function listBaseUsers(token: string, baseId: string): Promise<unknown> {
  return request(`/api/v1/db/meta/projects/${baseId}/users`, { token });
}

export async function inviteBaseUser(
  token: string,
  baseId: string,
  email: string,
  roles: string,
): Promise<unknown> {
  return request(`/api/v1/db/meta/projects/${baseId}/users`, {
    method: 'POST',
    token,
    body: { email, roles },
  });
}

export async function updateBaseUser(
  token: string,
  baseId: string,
  userId: string,
  roles: string,
): Promise<unknown> {
  return request(`/api/v1/db/meta/projects/${baseId}/users/${userId}`, {
    method: 'PATCH',
    token,
    body: { roles },
  });
}

export async function removeBaseUser(
  token: string,
  baseId: string,
  userId: string,
): Promise<unknown> {
  return request(`/api/v1/db/meta/projects/${baseId}/users/${userId}`, {
    method: 'DELETE',
    token,
  });
}

// ---------------------------------------------------------------------------
// Integrations CRUD (v2 — workspace-scoped)
// ---------------------------------------------------------------------------

export async function listIntegrations(token: string, wsId: string): Promise<unknown> {
  return request(`/api/v2/meta/workspaces/${wsId}/integrations`, { token });
}

export async function getIntegration(token: string, wsId: string, integrationId: string): Promise<unknown> {
  return request(`/api/v2/meta/workspaces/${wsId}/integrations/${integrationId}`, { token });
}

export async function createIntegration(
  token: string,
  wsId: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  return request(`/api/v2/meta/workspaces/${wsId}/integrations`, { method: 'POST', token, body: data });
}

export async function updateIntegration(
  token: string,
  wsId: string,
  integrationId: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  return request(`/api/v2/meta/workspaces/${wsId}/integrations/${integrationId}`, {
    method: 'PATCH',
    token,
    body: data,
  });
}

export async function deleteIntegration(token: string, wsId: string, integrationId: string): Promise<unknown> {
  return request(`/api/v2/meta/workspaces/${wsId}/integrations/${integrationId}`, { method: 'DELETE', token });
}

// ---------------------------------------------------------------------------
// Sources / Data Sources (v1)
// ---------------------------------------------------------------------------

export async function listSources(token: string, baseId: string): Promise<unknown> {
  return request(`/api/v1/db/meta/projects/${baseId}/bases`, { token });
}

export async function getSource(
  token: string,
  baseId: string,
  sourceId: string,
): Promise<unknown> {
  return request(`/api/v1/db/meta/projects/${baseId}/bases/${sourceId}`, { token });
}

export async function updateSource(
  token: string,
  baseId: string,
  sourceId: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  return request(`/api/v1/db/meta/projects/${baseId}/bases/${sourceId}`, {
    method: 'PATCH',
    token,
    body: data,
  });
}

// ---------------------------------------------------------------------------
// Snapshots (v2 — EE)
// ---------------------------------------------------------------------------

export async function listSnapshots(token: string, baseId: string): Promise<unknown> {
  return request(`/api/v2/meta/bases/${baseId}/snapshots`, { token });
}

export async function updateSnapshot(
  token: string,
  baseId: string,
  snapshotId: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  return request(`/api/v2/meta/bases/${baseId}/snapshots/${snapshotId}`, {
    method: 'PATCH',
    token,
    body: data,
  });
}

export async function deleteSnapshot(
  token: string,
  baseId: string,
  snapshotId: string,
): Promise<unknown> {
  return request(`/api/v2/meta/bases/${baseId}/snapshots/${snapshotId}`, {
    method: 'DELETE',
    token,
  });
}

// ---------------------------------------------------------------------------
// Plugins (v1)
// ---------------------------------------------------------------------------

export async function listPlugins(token: string): Promise<unknown> {
  return request('/api/v1/db/meta/plugins', { token });
}

export async function getPlugin(token: string, pluginId: string): Promise<unknown> {
  return request(`/api/v1/db/meta/plugins/${pluginId}`, { token });
}

export async function updatePlugin(
  token: string,
  pluginId: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  return request(`/api/v1/db/meta/plugins/${pluginId}`, { method: 'PATCH', token, body: data });
}

export async function testPlugin(token: string, data: Record<string, unknown>): Promise<unknown> {
  return request('/api/v1/db/meta/plugins/test', { method: 'POST', token, body: data });
}

// ---------------------------------------------------------------------------
// Model Visibilities / UI ACL (v1)
// ---------------------------------------------------------------------------

export async function getVisibilityRules(token: string, baseId: string): Promise<unknown> {
  return request(`/api/v1/db/meta/projects/${baseId}/visibility-rules`, { token });
}

export async function setVisibilityRules(
  token: string,
  baseId: string,
  rules: unknown,
): Promise<unknown> {
  return request(`/api/v1/db/meta/projects/${baseId}/visibility-rules`, {
    method: 'POST',
    token,
    body: rules,
  });
}

// ---------------------------------------------------------------------------
// Org Users (v2 — super admin)
// ---------------------------------------------------------------------------

export async function listOrgUsers(
  token: string,
  orgId: string,
  params?: Record<string, string | number | undefined>,
): Promise<unknown> {
  return request(`/api/v2/orgs/${orgId}/users`, { token, params });
}

export async function createOrgUser(
  token: string,
  orgId: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  return request(`/api/v2/orgs/${orgId}/users`, { method: 'POST', token, body: data });
}

export async function updateOrgUser(
  token: string,
  orgId: string,
  userId: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  return request(`/api/v2/orgs/${orgId}/user/${userId}`, { method: 'PATCH', token, body: data });
}

export async function deleteOrgUser(token: string, orgId: string, userId: string): Promise<unknown> {
  return request(`/api/v2/orgs/${orgId}/user/${userId}`, { method: 'DELETE', token });
}

// ---------------------------------------------------------------------------
// Org Tokens (v1)
// ---------------------------------------------------------------------------

export async function listOrgTokens(token: string): Promise<unknown> {
  return request('/api/v1/tokens', { token });
}

export async function createOrgToken(
  token: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  return request('/api/v1/tokens', { method: 'POST', token, body: data });
}

export async function deleteOrgToken(token: string, tokenId: string): Promise<unknown> {
  return request(`/api/v1/tokens/${tokenId}`, { method: 'DELETE', token });
}

// ---------------------------------------------------------------------------
// Jobs (v2)
// ---------------------------------------------------------------------------

export async function listJobs(
  token: string,
  baseId: string,
  filter?: Record<string, unknown>,
): Promise<unknown> {
  return request(`/api/v2/jobs/${baseId}`, { method: 'POST', token, body: filter || {} });
}

// ---------------------------------------------------------------------------
// Swagger / API Docs
// ---------------------------------------------------------------------------

export async function getSwagger(token: string, baseId: string): Promise<unknown> {
  return request(`/api/v3/meta/bases/${baseId}/swagger.json`, { token });
}

// ---------------------------------------------------------------------------
// App Info / Utils
// ---------------------------------------------------------------------------

export async function appInfo(token: string): Promise<unknown> {
  return request('/api/v1/db/meta/nocodb/info', { token });
}

export async function testConnection(
  token: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  return request('/api/v1/db/meta/connection/test', { method: 'POST', token, body: data });
}

// ---------------------------------------------------------------------------
// Cache Admin (v1)
// ---------------------------------------------------------------------------

export async function getCache(token: string): Promise<unknown> {
  return request('/api/v1/db/meta/cache', { token });
}

export async function clearCache(token: string): Promise<unknown> {
  return request('/api/v1/db/meta/cache', { method: 'DELETE', token });
}

// ---------------------------------------------------------------------------
// User Profile (v2)
// ---------------------------------------------------------------------------

export async function updateProfile(
  token: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  return request('/api/v2/meta/user/profile', { method: 'PATCH', token, body: data });
}

// ---------------------------------------------------------------------------
// SQL View (v1)
// ---------------------------------------------------------------------------

export async function createSqlView(
  token: string,
  baseId: string,
  sourceId: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  return request(`/api/v1/db/meta/projects/${baseId}/bases/${sourceId}/sqlView`, {
    method: 'POST',
    token,
    body: data,
  });
}
