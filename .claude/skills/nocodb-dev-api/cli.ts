#!/usr/bin/env npx tsx
import type { Role } from './lib/types.js';
import { ROLES, TEST_USERS } from './lib/types.js';
import { getToken, readState } from './lib/state.js';
import { init, ensureSampleData } from './lib/init.js';
import * as api from './lib/api.js';

// ---------------------------------------------------------------------------
// Flag parser: --key=value or --key value
// ---------------------------------------------------------------------------

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    const eqIdx = arg.indexOf('=');
    if (eqIdx !== -1) {
      flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
    } else {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = 'true';
      }
    }
  }
  return flags;
}

function requireFlag(flags: Record<string, string>, name: string): string {
  const val = flags[name];
  if (!val) throw new Error(`Missing required flag: --${name}`);
  return val;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON for --data: ${raw}`);
  }
}

function resolveRole(flags: Record<string, string>): Role {
  const role = (flags.as || 'owner') as Role;
  if (!ROLES.includes(role)) {
    throw new Error(`Unknown role: ${role}. Use: ${ROLES.join(', ')}`);
  }
  return role;
}

function token(flags: Record<string, string>): string {
  return getToken(resolveRole(flags));
}

/** Resolve workspace ID from --workspace flag or state */
function wsId(flags: Record<string, string>): string {
  const explicit = flags.workspace;
  if (explicit) return explicit;
  const ws = readState()?.workspace;
  if (ws) return ws.id;
  throw new Error('No workspace. Pass --workspace=ID or run init first.');
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function out(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function fail(msg: string): never {
  process.stdout.write(JSON.stringify({ error: msg }) + '\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

type Handler = (flags: Record<string, string>) => Promise<unknown>;

const commands: Record<string, Handler> = {
  // Setup
  async init(flags) {
    return init(flags.url);
  },
  async 'sample-data'() {
    return ensureSampleData();
  },

  // Auth (v1)
  async signin(flags) {
    if (flags.as) {
      const role = resolveRole(flags);
      const { email, password } = TEST_USERS[role];
      return api.signin(email, password);
    }
    return api.signin(requireFlag(flags, 'email'), requireFlag(flags, 'password'));
  },
  async health() {
    return api.health();
  },
  async version() {
    return api.version();
  },
  async me(flags) {
    return api.me(token(flags));
  },

  // Workspaces (v3)
  async 'list-workspaces'(flags) {
    return api.listWorkspaces(token(flags));
  },
  async 'create-workspace'(flags) {
    return api.createWorkspace(token(flags), requireFlag(flags, 'title'));
  },
  async 'get-workspace'(flags) {
    return api.getWorkspace(token(flags), requireFlag(flags, 'id'));
  },
  async 'update-workspace'(flags) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (!['id', 'as'].includes(k)) data[k] = v;
    }
    return api.updateWorkspace(token(flags), requireFlag(flags, 'id'), data);
  },
  async 'delete-workspace'(flags) {
    return api.deleteWorkspace(token(flags), requireFlag(flags, 'id'));
  },

  // Workspace Members (v3)
  async 'list-workspace-users'(flags) {
    return api.listWorkspaceUsers(token(flags), wsId(flags));
  },
  async 'invite-workspace-member'(flags) {
    return api.inviteToWorkspace(
      token(flags),
      wsId(flags),
      requireFlag(flags, 'email'),
      requireFlag(flags, 'role'),
    );
  },
  async 'update-workspace-member'(flags) {
    return api.updateWorkspaceMember(
      token(flags),
      wsId(flags),
      requireFlag(flags, 'user-id'),
      requireFlag(flags, 'role'),
    );
  },
  async 'remove-workspace-member'(flags) {
    return api.removeWorkspaceMember(
      token(flags),
      wsId(flags),
      requireFlag(flags, 'user-id'),
    );
  },

  // Bases (v3)
  async 'list-bases'(flags) {
    return api.listBases(token(flags), wsId(flags));
  },
  async 'create-base'(flags) {
    return api.createBase(token(flags), wsId(flags), requireFlag(flags, 'title'));
  },
  async 'get-base'(flags) {
    return api.getBase(token(flags), requireFlag(flags, 'id'));
  },
  async 'update-base'(flags) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (!['id', 'as', 'workspace'].includes(k)) data[k] = v;
    }
    return api.updateBase(token(flags), requireFlag(flags, 'id'), data);
  },
  async 'delete-base'(flags) {
    return api.deleteBase(token(flags), requireFlag(flags, 'id'));
  },

  // Base Members (v3)
  async 'invite-base-member'(flags) {
    return api.inviteBaseMember(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'email'),
      requireFlag(flags, 'role'),
    );
  },
  async 'update-base-member'(flags) {
    return api.updateBaseMember(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'user-id'),
      requireFlag(flags, 'role'),
    );
  },
  async 'remove-base-member'(flags) {
    return api.removeBaseMember(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'user-id'),
    );
  },

  // Tables (v3)
  async 'list-tables'(flags) {
    return api.listTables(token(flags), requireFlag(flags, 'base'));
  },
  async 'create-table'(flags) {
    const fields = parseJson(requireFlag(flags, 'fields')) as Array<{
      title: string;
      type: string;
    }>;
    return api.createTable(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'title'),
      fields,
    );
  },
  async 'get-table'(flags) {
    return api.getTable(token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'));
  },
  async 'update-table'(flags) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (!['base', 'id', 'as', 'workspace'].includes(k)) data[k] = v;
    }
    return api.updateTable(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'id'),
      data,
    );
  },
  async 'delete-table'(flags) {
    return api.deleteTable(token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'));
  },

  // Fields (v3)
  async 'list-fields'(flags) {
    return api.listFields(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
    );
  },
  async 'get-field'(flags) {
    return api.getField(token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'));
  },
  async 'create-field'(flags) {
    const field: Record<string, unknown> = {
      title: requireFlag(flags, 'title'),
      type: requireFlag(flags, 'type'),
    };
    // Pass through extra flags as field properties (e.g. --dtxp for select options)
    for (const [k, v] of Object.entries(flags)) {
      if (!['base', 'table', 'title', 'type', 'as'].includes(k)) {
        field[k] = v;
      }
    }
    return api.createField(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      field as any,
    );
  },
  async 'update-field'(flags) {
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (!['base', 'id', 'as'].includes(k)) {
        updates[k] = v;
      }
    }
    return api.updateField(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'id'),
      updates,
    );
  },
  async 'delete-field'(flags) {
    return api.deleteField(token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'));
  },

  // Views (internal)
  async 'list-views'(flags) {
    return api.listViews(
      token(flags),
      wsId(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
    );
  },
  async 'create-view'(flags) {
    return api.createView(
      token(flags),
      wsId(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'title'),
      flags.type || 'grid',
    );
  },
  async 'get-view'(flags) {
    return api.getView(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'table'), requireFlag(flags, 'id'));
  },
  async 'update-view'(flags) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (!['base', 'id', 'as', 'workspace', 'table'].includes(k)) data[k] = v;
    }
    return api.updateView(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data);
  },
  async 'delete-view'(flags) {
    return api.deleteView(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'));
  },

  // View Columns (internal)
  async 'list-view-columns'(flags) {
    return api.listViewColumns(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'view'));
  },
  async 'update-view-columns'(flags) {
    const data = parseJson(requireFlag(flags, 'data'));
    return api.updateViewColumns(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'view'), requireFlag(flags, 'column'), data);
  },

  // Filters (v3)
  async 'list-filters'(flags) {
    return api.listFilters(token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'view'));
  },
  async 'create-filter'(flags) {
    const filter = parseJson(requireFlag(flags, 'data'));
    return api.createFilter(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'view'),
      filter,
    );
  },
  async 'update-filter'(flags) {
    const filter = parseJson(requireFlag(flags, 'data'));
    return api.updateFilter(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'view'),
      filter,
    );
  },
  async 'replace-filters'(flags) {
    const filters = parseJson(requireFlag(flags, 'data'));
    return api.replaceFilters(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'view'),
      filters,
    );
  },
  async 'delete-filter'(flags) {
    return api.deleteFilter(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'view'),
      requireFlag(flags, 'id'),
    );
  },

  // Sorts (v3)
  async 'list-sorts'(flags) {
    return api.listSorts(token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'view'));
  },
  async 'create-sort'(flags) {
    return api.createSort(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'view'),
      {
        field_id: requireFlag(flags, 'field-id'),
        direction: (flags.direction as 'asc' | 'desc') || undefined,
      },
    );
  },
  async 'update-sort'(flags) {
    return api.updateSort(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'view'),
      {
        id: requireFlag(flags, 'id'),
        field_id: flags['field-id'] || undefined,
        direction: (flags.direction as 'asc' | 'desc') || undefined,
      },
    );
  },
  async 'delete-sort'(flags) {
    return api.deleteSort(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'view'),
      requireFlag(flags, 'id'),
    );
  },

  // Comments (v3)
  async 'list-comments'(flags) {
    return api.listComments(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'row'),
    );
  },
  async 'create-comment'(flags) {
    return api.createComment(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'row'),
      requireFlag(flags, 'comment'),
    );
  },
  async 'update-comment'(flags) {
    return api.updateComment(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'id'),
      requireFlag(flags, 'comment'),
    );
  },
  async 'delete-comment'(flags) {
    return api.deleteComment(token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'));
  },

  // Hooks (internal)
  async 'list-hooks'(flags) {
    return api.hookList(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'table'));
  },
  async 'create-hook'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.hookCreate(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'table'), data);
  },
  async 'update-hook'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.hookUpdate(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data);
  },
  async 'delete-hook'(flags) {
    return api.hookDelete(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'));
  },

  // Links (v3)
  async 'list-links'(flags) {
    return api.listLinks(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'column'),
      requireFlag(flags, 'row'),
      {
        limit: flags.limit ? Number(flags.limit) : undefined,
        offset: flags.offset ? Number(flags.offset) : undefined,
      },
    );
  },
  async 'link-records'(flags) {
    const ids = parseJson(requireFlag(flags, 'ids'));
    return api.linkRecords(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'column'),
      requireFlag(flags, 'row'),
      ids as (string | number)[],
    );
  },
  async 'unlink-records'(flags) {
    const ids = parseJson(requireFlag(flags, 'ids'));
    return api.unlinkRecords(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'column'),
      requireFlag(flags, 'row'),
      ids as (string | number)[],
    );
  },

  // Attachment Upload (v3)
  async 'upload-attachment'(flags) {
    return api.uploadAttachment(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'row'),
      requireFlag(flags, 'column'),
      {
        contentType: requireFlag(flags, 'content-type'),
        file: requireFlag(flags, 'file'),
        filename: requireFlag(flags, 'filename'),
      },
    );
  },

  // API Tokens (v3)
  async 'list-tokens'(flags) {
    return api.listTokens(token(flags));
  },
  async 'create-token'(flags) {
    return api.createToken(token(flags), requireFlag(flags, 'title'));
  },
  async 'delete-token'(flags) {
    return api.deleteToken(token(flags), requireFlag(flags, 'id'));
  },

  // Scripts (internal — EE)
  async 'list-scripts'(flags) {
    return api.listScripts(token(flags), wsId(flags), requireFlag(flags, 'base'));
  },
  async 'get-script'(flags) {
    return api.getScript(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'));
  },
  async 'create-script'(flags) {
    const script = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.createScript(token(flags), wsId(flags), requireFlag(flags, 'base'), script);
  },
  async 'update-script'(flags) {
    const script = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.updateScript(
      token(flags),
      wsId(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'id'),
      script,
    );
  },
  async 'delete-script'(flags) {
    return api.deleteScript(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'));
  },

  // Records (v3) — uses --base (base ID or name) and --table (table ID or name)
  async 'list-records'(flags) {
    return api.listRecords(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      {
        where: flags.where,
        limit: flags.limit ? Number(flags.limit) : undefined,
        offset: flags.offset ? Number(flags.offset) : undefined,
        sort: flags.sort,
        fields: flags.fields,
        viewId: flags.view,
      },
    );
  },
  async 'get-record'(flags) {
    return api.getRecord(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'id'),
    );
  },
  async 'create-record'(flags) {
    const data = parseJson(requireFlag(flags, 'data'));
    return api.createRecord(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      data as any,
    );
  },
  async 'create-records'(flags) {
    const data = parseJson(requireFlag(flags, 'data'));
    if (!Array.isArray(data)) throw new Error('--data must be a JSON array for create-records');
    return api.createRecords(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      data,
    );
  },
  async 'update-record'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.updateRecord(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'id'),
      data,
    );
  },
  async 'delete-record'(flags) {
    return api.deleteRecord(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'id'),
    );
  },
  async 'count-records'(flags) {
    return api.countRecords(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      flags.where,
    );
  },

  // Raw / custom request — for testing arbitrary endpoints
  async raw(flags) {
    const method = (flags.method || 'GET').toUpperCase();
    const path = requireFlag(flags, 'path');
    const body = flags.data ? parseJson(flags.data) : undefined;
    const params: Record<string, string | number | undefined> = {};
    // Collect --param-* flags as query params
    for (const [k, v] of Object.entries(flags)) {
      if (k.startsWith('param-')) params[k.slice(6)] = v;
    }
    return api.request(path, {
      method,
      token: flags.as ? token(flags) : (flags['no-auth'] ? undefined : token(flags)),
      body,
      params: Object.keys(params).length ? params : undefined,
    });
  },

  // =========================================================================
  // INTERNAL APIs (non-v3)
  // =========================================================================

  // Internal API generic command (covers all /api/v2/internal operations)
  async internal(flags) {
    const method = (flags.method || 'POST').toUpperCase();
    const body = flags.data ? parseJson(flags.data) : undefined;
    const params: Record<string, string | number | undefined> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (k.startsWith('param-')) params[k.slice(6)] = v;
    }
    return api.internal(
      token(flags),
      wsId(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'operation'),
      { method, body, params: Object.keys(params).length ? params : undefined },
    );
  },

  // Shared Views (v1 list + internal create/update/delete)
  async 'list-shared-views'(flags) {
    return api.listSharedViews(token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'table'));
  },
  async 'create-shared-view'(flags) {
    return api.shareViewCreate(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'view'));
  },
  async 'update-shared-view'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.shareViewUpdate(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'view'), data);
  },
  async 'delete-shared-view'(flags) {
    return api.shareViewDelete(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'view'));
  },

  // Shared Bases
  async 'get-shared-base'(flags) {
    return api.getSharedBase(token(flags), requireFlag(flags, 'base'));
  },
  async 'create-shared-base'(flags) {
    return api.createSharedBase(token(flags), requireFlag(flags, 'base'));
  },
  async 'update-shared-base'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.updateSharedBase(token(flags), requireFlag(flags, 'base'), data);
  },
  async 'delete-shared-base'(flags) {
    return api.deleteSharedBase(token(flags), requireFlag(flags, 'base'));
  },

  // Public Shared View Data (no auth)
  async 'get-shared-view-meta'(flags) {
    return api.getSharedViewMeta(requireFlag(flags, 'uuid'));
  },
  async 'get-shared-view-rows'(flags) {
    const params: Record<string, string | number | undefined> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (k.startsWith('param-')) params[k.slice(6)] = v;
    }
    return api.getSharedViewRows(
      requireFlag(flags, 'uuid'),
      Object.keys(params).length ? params : undefined,
    );
  },
  async 'submit-shared-view-row'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.submitSharedViewRow(requireFlag(flags, 'uuid'), data);
  },

  // File Storage
  async 'upload-file'(flags) {
    return api.uploadFile(
      token(flags),
      requireFlag(flags, 'file'),
      flags.path ? { path: flags.path } : undefined,
    );
  },
  async 'upload-by-url'(flags) {
    const urls = parseJson(requireFlag(flags, 'data')) as Array<{ url: string; fileName?: string }>;
    return api.uploadByUrl(token(flags), urls, flags.path ? { path: flags.path } : undefined);
  },

  // Bulk Data Operations
  async 'bulk-insert'(flags) {
    const records = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>[];
    return api.bulkInsert(token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'table'), records);
  },
  async 'bulk-update'(flags) {
    const records = parseJson(requireFlag(flags, 'data')) as Array<Record<string, unknown>>;
    return api.bulkUpdate(token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'table'), records);
  },
  async 'bulk-delete'(flags) {
    const ids = parseJson(requireFlag(flags, 'data')) as Array<Record<string, unknown>>;
    return api.bulkDelete(token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'table'), ids);
  },
  async 'bulk-update-all'(flags) {
    const body = parseJson(requireFlag(flags, 'data')) as { where?: string; fields: Record<string, unknown> };
    return api.bulkUpdateAll(token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'table'), body);
  },
  async 'bulk-delete-all'(flags) {
    const body = parseJson(requireFlag(flags, 'data')) as { where?: string };
    return api.bulkDeleteAll(token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'table'), body);
  },

  // Aggregate (internal)
  async aggregate(flags) {
    const opts: Record<string, unknown> = {};
    if (flags.view) opts.viewId = flags.view;
    for (const [k, v] of Object.entries(flags)) {
      if (!['table', 'as', 'workspace', 'base', 'view'].includes(k)) opts[k] = v;
    }
    return api.dataAggregate(
      token(flags),
      wsId(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      Object.keys(opts).length ? opts : undefined,
    );
  },

  // Notifications
  async 'list-notifications'(flags) {
    return api.listNotifications(token(flags));
  },
  async 'mark-notification-read'(flags) {
    const data = flags.data ? parseJson(flags.data) as Record<string, unknown> : { is_read: true };
    return api.markNotificationRead(token(flags), requireFlag(flags, 'id'), data);
  },
  async 'delete-notification'(flags) {
    return api.deleteNotification(token(flags), requireFlag(flags, 'id'));
  },
  async 'mark-all-notifications-read'(flags) {
    return api.markAllNotificationsRead(token(flags));
  },

  // Form View Config (internal)
  async 'get-form-view'(flags) {
    return api.formViewGet(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'));
  },
  async 'update-form-view'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.formViewUpdate(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data);
  },
  async 'update-form-column'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.formColumnUpdate(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data);
  },

  // Gallery View Config
  async 'get-gallery-view'(flags) {
    return api.getGalleryView(token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'));
  },
  async 'update-gallery-view'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.galleryViewUpdate(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data);
  },

  // Kanban View Config
  async 'get-kanban-view'(flags) {
    return api.getKanbanView(token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'));
  },
  async 'update-kanban-view'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.kanbanViewUpdate(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data);
  },

  // Grid View Config
  async 'list-grid-columns'(flags) {
    return api.listGridColumns(token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'));
  },
  async 'update-grid-column'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.gridColumnUpdate(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data);
  },

  // Map View Config (internal)
  async 'get-map-view'(flags) {
    return api.mapViewGet(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'));
  },
  async 'update-map-view'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.mapViewUpdate(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data);
  },

  // Calendar Data
  async 'calendar-data'(flags) {
    const params: Record<string, string | number | undefined> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (k.startsWith('param-')) params[k.slice(6)] = v;
    }
    return api.calendarData(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'view-name'),
      Object.keys(params).length ? params : undefined,
    );
  },
  async 'calendar-count-by-date'(flags) {
    const params: Record<string, string | number | undefined> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (k.startsWith('param-')) params[k.slice(6)] = v;
    }
    return api.calendarCountByDate(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'view-name'),
      Object.keys(params).length ? params : undefined,
    );
  },

  // Base Users / Collaborators (v1)
  async 'list-base-users'(flags) {
    return api.listBaseUsers(token(flags), requireFlag(flags, 'base'));
  },
  async 'invite-base-user'(flags) {
    return api.inviteBaseUser(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'email'),
      requireFlag(flags, 'roles'),
    );
  },
  async 'update-base-user'(flags) {
    return api.updateBaseUser(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'user-id'),
      requireFlag(flags, 'roles'),
    );
  },
  async 'remove-base-user'(flags) {
    return api.removeBaseUser(token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'user-id'));
  },

  // Extensions (internal)
  async 'list-extensions'(flags) {
    return api.extensionList(token(flags), wsId(flags), requireFlag(flags, 'base'));
  },
  async 'get-extension'(flags) {
    return api.extensionRead(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'));
  },
  async 'create-extension'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.extensionCreate(token(flags), wsId(flags), requireFlag(flags, 'base'), data);
  },
  async 'update-extension'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.extensionUpdate(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data);
  },
  async 'delete-extension'(flags) {
    return api.extensionDelete(token(flags), wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'));
  },

  // Integrations
  async 'list-integrations'(flags) {
    return api.listIntegrations(token(flags), wsId(flags));
  },
  async 'get-integration'(flags) {
    return api.getIntegration(token(flags), wsId(flags), requireFlag(flags, 'id'));
  },
  async 'create-integration'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.createIntegration(token(flags), wsId(flags), data);
  },
  async 'update-integration'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.updateIntegration(token(flags), wsId(flags), requireFlag(flags, 'id'), data);
  },
  async 'delete-integration'(flags) {
    return api.deleteIntegration(token(flags), wsId(flags), requireFlag(flags, 'id'));
  },

  // Sources / Data Sources
  async 'list-sources'(flags) {
    return api.listSources(token(flags), requireFlag(flags, 'base'));
  },
  async 'get-source'(flags) {
    return api.getSource(token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'));
  },
  async 'update-source'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.updateSource(token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data);
  },

  // Snapshots (EE)
  async 'list-snapshots'(flags) {
    return api.listSnapshots(token(flags), requireFlag(flags, 'base'));
  },
  async 'update-snapshot'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.updateSnapshot(token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data);
  },
  async 'delete-snapshot'(flags) {
    return api.deleteSnapshot(token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'));
  },

  // Plugins
  async 'list-plugins'(flags) {
    return api.listPlugins(token(flags));
  },
  async 'get-plugin'(flags) {
    return api.getPlugin(token(flags), requireFlag(flags, 'id'));
  },
  async 'update-plugin'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.updatePlugin(token(flags), requireFlag(flags, 'id'), data);
  },
  async 'test-plugin'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.testPlugin(token(flags), data);
  },

  // Model Visibilities / UI ACL
  async 'get-visibility-rules'(flags) {
    return api.getVisibilityRules(token(flags), requireFlag(flags, 'base'));
  },
  async 'set-visibility-rules'(flags) {
    const rules = parseJson(requireFlag(flags, 'data'));
    return api.setVisibilityRules(token(flags), requireFlag(flags, 'base'), rules);
  },

  // Org Users (admin — requires org admin role)
  async 'list-org-users'(flags) {
    return api.listOrgUsers(token(flags), wsId(flags));
  },
  async 'create-org-user'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.createOrgUser(token(flags), wsId(flags), data);
  },
  async 'update-org-user'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.updateOrgUser(token(flags), wsId(flags), requireFlag(flags, 'id'), data);
  },
  async 'delete-org-user'(flags) {
    return api.deleteOrgUser(token(flags), wsId(flags), requireFlag(flags, 'id'));
  },

  // Org Tokens
  async 'list-org-tokens'(flags) {
    return api.listOrgTokens(token(flags));
  },
  async 'create-org-token'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.createOrgToken(token(flags), data);
  },
  async 'delete-org-token'(flags) {
    return api.deleteOrgToken(token(flags), requireFlag(flags, 'id'));
  },

  // Jobs
  async 'list-jobs'(flags) {
    const filter = flags.data ? parseJson(flags.data) as Record<string, unknown> : undefined;
    return api.listJobs(token(flags), requireFlag(flags, 'base'), filter);
  },

  // Swagger
  async swagger(flags) {
    return api.getSwagger(token(flags), requireFlag(flags, 'base'));
  },

  // App Info
  async 'app-info'(flags) {
    return api.appInfo(token(flags));
  },
  async 'test-connection'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.testConnection(token(flags), data);
  },

  // Cache
  async 'get-cache'(flags) {
    return api.getCache(token(flags));
  },
  async 'clear-cache'(flags) {
    return api.clearCache(token(flags));
  },

  // User Profile
  async 'update-profile'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.updateProfile(token(flags), data);
  },

  // SQL View
  async 'create-sql-view'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.createSqlView(
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'source'),
      data,
    );
  },

  // State inspection
  async state() {
    const s = readState();
    if (!s) throw new Error('Not initialized. Run: npx tsx cli.ts init');
    return s;
  },
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help') {
    out({
      usage: 'npx tsx cli.ts <command> [--flags]',
      commands: Object.keys(commands).sort(),
      flags: {
        '--as': 'Role to use (owner|creator|editor|commenter|viewer). Default: owner',
        '--url': 'NocoDB URL (for init command)',
        '--base': 'Base ID (required for table/field/view/record commands)',
        '--table': 'Table ID (required for field/view/record commands)',
        '--workspace': 'Workspace ID (auto-resolved from state if omitted)',
        '--view': 'View ID (required for filter/sort/view-column commands)',
      },
      raw: 'Use "raw" command for arbitrary API calls: raw --method=POST --path=/api/v3/... --data=\'{"key":"val"}\' --as=owner',
    });
    return;
  }

  const handler = commands[command];
  if (!handler) {
    fail(`Unknown command: ${command}. Run with 'help' to see available commands.`);
  }

  const flags = parseFlags(args.slice(1));
  const result = await handler(flags);
  out(result);
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
