#!/usr/bin/env npx tsx
import { getCredential, storeCredential, refreshAllTokens } from './lib/credentials.js';
import { resolveWsId, baseWsCache } from './lib/api.js';
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

/** Get the NocoDB URL — required on every command */
function url(flags: Record<string, string>): string {
  return requireFlag(flags, 'url');
}

/** Get the auth token for --as user from the credential store */
function token(flags: Record<string, string>): string {
  const u = url(flags);
  const as = requireFlag(flags, 'as');
  const cred = getCredential(u, as);
  if (!cred) {
    throw new Error(`No credential for "${as}" at ${u}. Sign in first.`);
  }
  return cred.token;
}

/** The email from --as flag (for 401 auto-retry) */
function as(flags: Record<string, string>): string {
  return requireFlag(flags, 'as');
}

/** Resolve workspace ID: explicit --workspace, or auto-resolve from --base */
async function wsId(flags: Record<string, string>): Promise<string> {
  const explicit = flags.workspace;
  if (explicit) return explicit;
  const baseId = flags.base;
  if (baseId) {
    return resolveWsId(url(flags), token(flags), baseId, flags.as);
  }
  throw new Error('No workspace. Pass --workspace=ID or --base=ID (auto-resolves workspace).');
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
  // Auth (v1)
  async signin(flags) {
    const u = url(flags);
    const email = requireFlag(flags, 'email');
    const password = requireFlag(flags, 'password');
    const res = await api.signin(u, email, password);
    storeCredential(u, email, password, res.token);
    return res;
  },
  async signup(flags) {
    const u = url(flags);
    const email = requireFlag(flags, 'email');
    const password = requireFlag(flags, 'password');
    const res = await api.signup(u, email, password);
    storeCredential(u, email, password, res.token);
    return res;
  },
  async 'refresh-tokens'(flags) {
    const u = flags.url;  // optional filter
    const tokens = await refreshAllTokens(u);
    return { refreshed: Object.keys(tokens), count: Object.keys(tokens).length };
  },
  async health(flags) {
    return api.health(url(flags));
  },
  async version(flags) {
    return api.version(url(flags));
  },
  async me(flags) {
    return api.me(url(flags), token(flags), flags.as);
  },

  // Workspaces (v3)
  async 'list-workspaces'(flags) {
    return api.listWorkspaces(url(flags), token(flags), flags.as);
  },
  async 'create-workspace'(flags) {
    return api.createWorkspace(url(flags), token(flags), requireFlag(flags, 'title'), flags.as);
  },
  async 'get-workspace'(flags) {
    return api.getWorkspace(url(flags), token(flags), requireFlag(flags, 'id'), flags.as);
  },
  async 'update-workspace'(flags) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (!['id', 'as', 'url'].includes(k)) data[k] = v;
    }
    return api.updateWorkspace(url(flags), token(flags), requireFlag(flags, 'id'), data, flags.as);
  },
  async 'delete-workspace'(flags) {
    return api.deleteWorkspace(url(flags), token(flags), requireFlag(flags, 'id'), flags.as);
  },

  // Workspace Members (v3)
  async 'list-workspace-users'(flags) {
    return api.listWorkspaceUsers(url(flags), token(flags), await wsId(flags), flags.as);
  },
  async 'invite-workspace-member'(flags) {
    return api.inviteToWorkspace(
      url(flags),
      token(flags),
      await wsId(flags),
      requireFlag(flags, 'email'),
      requireFlag(flags, 'role'),
      flags.as,
    );
  },
  async 'update-workspace-member'(flags) {
    return api.updateWorkspaceMember(
      url(flags),
      token(flags),
      await wsId(flags),
      requireFlag(flags, 'user-id'),
      requireFlag(flags, 'role'),
      flags.as,
    );
  },
  async 'remove-workspace-member'(flags) {
    return api.removeWorkspaceMember(
      url(flags),
      token(flags),
      await wsId(flags),
      requireFlag(flags, 'user-id'),
      flags.as,
    );
  },

  // Bases (v3)
  async 'list-bases'(flags) {
    return api.listBases(url(flags), token(flags), await wsId(flags), flags.as);
  },
  async 'create-base'(flags) {
    return api.createBase(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'title'), flags.as);
  },
  async 'get-base'(flags) {
    return api.getBase(url(flags), token(flags), requireFlag(flags, 'id'), flags.as);
  },
  async 'update-base'(flags) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (!['id', 'as', 'workspace', 'url'].includes(k)) data[k] = v;
    }
    return api.updateBase(url(flags), token(flags), requireFlag(flags, 'id'), data, flags.as);
  },
  async 'delete-base'(flags) {
    return api.deleteBase(url(flags), token(flags), requireFlag(flags, 'id'), flags.as);
  },

  // Base Members (v3)
  async 'invite-base-member'(flags) {
    return api.inviteBaseMember(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'email'),
      requireFlag(flags, 'role'),
      flags.as,
    );
  },
  async 'update-base-member'(flags) {
    return api.updateBaseMember(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'user-id'),
      requireFlag(flags, 'role'),
      flags.as,
    );
  },
  async 'remove-base-member'(flags) {
    return api.removeBaseMember(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'user-id'),
      flags.as,
    );
  },

  // Tables (v3)
  async 'list-tables'(flags) {
    return api.listTables(url(flags), token(flags), requireFlag(flags, 'base'), flags.as);
  },
  async 'create-table'(flags) {
    const fields = parseJson(requireFlag(flags, 'fields')) as Array<{
      title: string;
      type: string;
    }>;
    return api.createTable(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'title'),
      fields,
      flags.as,
    );
  },
  async 'get-table'(flags) {
    return api.getTable(url(flags), token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), flags.as);
  },
  async 'update-table'(flags) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (!['base', 'id', 'as', 'workspace', 'url'].includes(k)) data[k] = v;
    }
    return api.updateTable(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'id'),
      data,
      flags.as,
    );
  },
  async 'delete-table'(flags) {
    return api.deleteTable(url(flags), token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), flags.as);
  },

  // Fields (v3)
  async 'list-fields'(flags) {
    return api.listFields(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      flags.as,
    );
  },
  async 'get-field'(flags) {
    return api.getField(url(flags), token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), flags.as);
  },
  async 'create-field'(flags) {
    const field: Record<string, unknown> = {
      title: requireFlag(flags, 'title'),
      type: requireFlag(flags, 'type'),
    };
    for (const [k, v] of Object.entries(flags)) {
      if (!['base', 'table', 'title', 'type', 'as', 'url'].includes(k)) {
        field[k] = v;
      }
    }
    return api.createField(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      field as any,
      flags.as,
    );
  },
  async 'update-field'(flags) {
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (!['base', 'id', 'as', 'url'].includes(k)) {
        updates[k] = v;
      }
    }
    return api.updateField(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'id'),
      updates,
      flags.as,
    );
  },
  async 'delete-field'(flags) {
    return api.deleteField(url(flags), token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), flags.as);
  },

  // Views (internal)
  async 'list-views'(flags) {
    return api.listViews(
      url(flags),
      token(flags),
      await wsId(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      flags.as,
    );
  },
  async 'create-view'(flags) {
    return api.createView(
      url(flags),
      token(flags),
      await wsId(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'title'),
      flags.type || 'grid',
      flags.as,
    );
  },
  async 'get-view'(flags) {
    return api.getView(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'table'), requireFlag(flags, 'id'), flags.as);
  },
  async 'update-view'(flags) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (!['base', 'id', 'as', 'workspace', 'table', 'url'].includes(k)) data[k] = v;
    }
    return api.updateView(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data, flags.as);
  },
  async 'delete-view'(flags) {
    return api.deleteView(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), flags.as);
  },

  // View Columns (internal)
  async 'list-view-columns'(flags) {
    return api.listViewColumns(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'view'), flags.as);
  },
  async 'update-view-columns'(flags) {
    const data = parseJson(requireFlag(flags, 'data'));
    return api.updateViewColumns(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'view'), requireFlag(flags, 'column'), data, flags.as);
  },

  // Filters (v3)
  async 'list-filters'(flags) {
    return api.listFilters(url(flags), token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'view'), flags.as);
  },
  async 'create-filter'(flags) {
    const filter = parseJson(requireFlag(flags, 'data'));
    return api.createFilter(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'view'),
      filter,
      flags.as,
    );
  },
  async 'update-filter'(flags) {
    const filter = parseJson(requireFlag(flags, 'data'));
    return api.updateFilter(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'view'),
      filter,
      flags.as,
    );
  },
  async 'replace-filters'(flags) {
    const filters = parseJson(requireFlag(flags, 'data'));
    return api.replaceFilters(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'view'),
      filters,
      flags.as,
    );
  },
  async 'delete-filter'(flags) {
    return api.deleteFilter(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'view'),
      requireFlag(flags, 'id'),
      flags.as,
    );
  },

  // Sorts (v3)
  async 'list-sorts'(flags) {
    return api.listSorts(url(flags), token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'view'), flags.as);
  },
  async 'create-sort'(flags) {
    return api.createSort(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'view'),
      {
        field_id: requireFlag(flags, 'field-id'),
        direction: (flags.direction as 'asc' | 'desc') || undefined,
      },
      flags.as,
    );
  },
  async 'update-sort'(flags) {
    return api.updateSort(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'view'),
      {
        id: requireFlag(flags, 'id'),
        field_id: flags['field-id'] || undefined,
        direction: (flags.direction as 'asc' | 'desc') || undefined,
      },
      flags.as,
    );
  },
  async 'delete-sort'(flags) {
    return api.deleteSort(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'view'),
      requireFlag(flags, 'id'),
      flags.as,
    );
  },

  // Comments (v3)
  async 'list-comments'(flags) {
    return api.listComments(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'row'),
      flags.as,
    );
  },
  async 'create-comment'(flags) {
    return api.createComment(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'row'),
      requireFlag(flags, 'comment'),
      flags.as,
    );
  },
  async 'update-comment'(flags) {
    return api.updateComment(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'id'),
      requireFlag(flags, 'comment'),
      flags.as,
    );
  },
  async 'delete-comment'(flags) {
    return api.deleteComment(url(flags), token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), flags.as);
  },

  // Hooks (internal)
  async 'list-hooks'(flags) {
    return api.hookList(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'table'), flags.as);
  },
  async 'create-hook'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.hookCreate(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'table'), data, flags.as);
  },
  async 'update-hook'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.hookUpdate(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data, flags.as);
  },
  async 'delete-hook'(flags) {
    return api.hookDelete(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), flags.as);
  },

  // Links (v3)
  async 'list-links'(flags) {
    return api.listLinks(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'column'),
      requireFlag(flags, 'row'),
      {
        limit: flags.limit ? Number(flags.limit) : undefined,
        offset: flags.offset ? Number(flags.offset) : undefined,
      },
      flags.as,
    );
  },
  async 'link-records'(flags) {
    const ids = parseJson(requireFlag(flags, 'ids'));
    return api.linkRecords(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'column'),
      requireFlag(flags, 'row'),
      ids as (string | number)[],
      flags.as,
    );
  },
  async 'unlink-records'(flags) {
    const ids = parseJson(requireFlag(flags, 'ids'));
    return api.unlinkRecords(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'column'),
      requireFlag(flags, 'row'),
      ids as (string | number)[],
      flags.as,
    );
  },

  // Attachment Upload (v3)
  async 'upload-attachment'(flags) {
    return api.uploadAttachment(
      url(flags),
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
      flags.as,
    );
  },

  // API Tokens (v3)
  async 'list-tokens'(flags) {
    return api.listTokens(url(flags), token(flags), flags.as);
  },
  async 'create-token'(flags) {
    return api.createToken(url(flags), token(flags), requireFlag(flags, 'title'), flags.as);
  },
  async 'delete-token'(flags) {
    return api.deleteToken(url(flags), token(flags), requireFlag(flags, 'id'), flags.as);
  },

  // Scripts (internal — EE)
  async 'list-scripts'(flags) {
    return api.listScripts(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), flags.as);
  },
  async 'get-script'(flags) {
    return api.getScript(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), flags.as);
  },
  async 'create-script'(flags) {
    const script = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.createScript(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), script, flags.as);
  },
  async 'update-script'(flags) {
    const script = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.updateScript(
      url(flags),
      token(flags),
      await wsId(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'id'),
      script,
      flags.as,
    );
  },
  async 'delete-script'(flags) {
    return api.deleteScript(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), flags.as);
  },

  // Records (v3)
  async 'list-records'(flags) {
    return api.listRecords(
      url(flags),
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
      flags.as,
    );
  },
  async 'get-record'(flags) {
    return api.getRecord(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'id'),
      flags.as,
    );
  },
  async 'create-record'(flags) {
    const data = parseJson(requireFlag(flags, 'data'));
    return api.createRecord(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      data as any,
      flags.as,
    );
  },
  async 'create-records'(flags) {
    const data = parseJson(requireFlag(flags, 'data'));
    if (!Array.isArray(data)) throw new Error('--data must be a JSON array for create-records');
    return api.createRecords(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      data,
      flags.as,
    );
  },
  async 'update-record'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.updateRecord(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'id'),
      data,
      flags.as,
    );
  },
  async 'delete-record'(flags) {
    return api.deleteRecord(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'id'),
      flags.as,
    );
  },
  async 'count-records'(flags) {
    return api.countRecords(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      flags.where,
      flags.as,
    );
  },

  // Raw / custom request
  async raw(flags) {
    const method = (flags.method || 'GET').toUpperCase();
    const path = requireFlag(flags, 'path');
    const body = flags.data ? parseJson(flags.data) : undefined;
    const params: Record<string, string | number | undefined> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (k.startsWith('param-')) params[k.slice(6)] = v;
    }
    return api.request(path, {
      url: url(flags),
      method,
      token: flags.as ? token(flags) : (flags['no-auth'] ? undefined : token(flags)),
      email: flags.as,
      body,
      params: Object.keys(params).length ? params : undefined,
    });
  },

  // =========================================================================
  // INTERNAL APIs (non-v3)
  // =========================================================================

  async internal(flags) {
    const method = (flags.method || 'POST').toUpperCase();
    const body = flags.data ? parseJson(flags.data) : undefined;
    const params: Record<string, string | number | undefined> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (k.startsWith('param-')) params[k.slice(6)] = v;
    }
    return api.internal(
      url(flags),
      token(flags),
      await wsId(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'operation'),
      { method, body, params: Object.keys(params).length ? params : undefined },
      flags.as,
    );
  },

  // Shared Views
  async 'list-shared-views'(flags) {
    return api.listSharedViews(url(flags), token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'table'), flags.as);
  },
  async 'create-shared-view'(flags) {
    return api.shareViewCreate(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'view'), flags.as);
  },
  async 'update-shared-view'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.shareViewUpdate(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'view'), data, flags.as);
  },
  async 'delete-shared-view'(flags) {
    return api.shareViewDelete(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'view'), flags.as);
  },

  // Shared Bases
  async 'get-shared-base'(flags) {
    return api.getSharedBase(url(flags), token(flags), requireFlag(flags, 'base'), flags.as);
  },
  async 'create-shared-base'(flags) {
    return api.createSharedBase(url(flags), token(flags), requireFlag(flags, 'base'), flags.as);
  },
  async 'update-shared-base'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.updateSharedBase(url(flags), token(flags), requireFlag(flags, 'base'), data, flags.as);
  },
  async 'delete-shared-base'(flags) {
    return api.deleteSharedBase(url(flags), token(flags), requireFlag(flags, 'base'), flags.as);
  },

  // Public Shared View Data (no auth)
  async 'get-shared-view-meta'(flags) {
    return api.getSharedViewMeta(url(flags), requireFlag(flags, 'uuid'));
  },
  async 'get-shared-view-rows'(flags) {
    const params: Record<string, string | number | undefined> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (k.startsWith('param-')) params[k.slice(6)] = v;
    }
    return api.getSharedViewRows(
      url(flags),
      requireFlag(flags, 'uuid'),
      Object.keys(params).length ? params : undefined,
    );
  },
  async 'submit-shared-view-row'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.submitSharedViewRow(url(flags), requireFlag(flags, 'uuid'), data);
  },

  // File Storage
  async 'upload-file'(flags) {
    return api.uploadFile(
      url(flags),
      token(flags),
      requireFlag(flags, 'file'),
      flags.path ? { path: flags.path } : undefined,
      flags.as,
    );
  },
  async 'upload-by-url'(flags) {
    const urls = parseJson(requireFlag(flags, 'data')) as Array<{ url: string; fileName?: string }>;
    return api.uploadByUrl(url(flags), token(flags), urls, flags.path ? { path: flags.path } : undefined, flags.as);
  },

  // Bulk Data Operations
  async 'bulk-insert'(flags) {
    const records = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>[];
    return api.bulkInsert(url(flags), token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'table'), records, flags.as);
  },
  async 'bulk-update'(flags) {
    const records = parseJson(requireFlag(flags, 'data')) as Array<Record<string, unknown>>;
    return api.bulkUpdate(url(flags), token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'table'), records, flags.as);
  },
  async 'bulk-delete'(flags) {
    const ids = parseJson(requireFlag(flags, 'data')) as Array<Record<string, unknown>>;
    return api.bulkDelete(url(flags), token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'table'), ids, flags.as);
  },
  async 'bulk-update-all'(flags) {
    const body = parseJson(requireFlag(flags, 'data')) as { where?: string; fields: Record<string, unknown> };
    return api.bulkUpdateAll(url(flags), token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'table'), body, flags.as);
  },
  async 'bulk-delete-all'(flags) {
    const body = parseJson(requireFlag(flags, 'data')) as { where?: string };
    return api.bulkDeleteAll(url(flags), token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'table'), body, flags.as);
  },

  // Aggregate (internal)
  async aggregate(flags) {
    const opts: Record<string, unknown> = {};
    if (flags.view) opts.viewId = flags.view;
    for (const [k, v] of Object.entries(flags)) {
      if (!['table', 'as', 'workspace', 'base', 'view', 'url'].includes(k)) opts[k] = v;
    }
    return api.dataAggregate(
      url(flags),
      token(flags),
      await wsId(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      Object.keys(opts).length ? opts : undefined,
      flags.as,
    );
  },

  // Notifications
  async 'list-notifications'(flags) {
    return api.listNotifications(url(flags), token(flags), flags.as);
  },
  async 'mark-notification-read'(flags) {
    const data = flags.data ? parseJson(flags.data) as Record<string, unknown> : { is_read: true };
    return api.markNotificationRead(url(flags), token(flags), requireFlag(flags, 'id'), data, flags.as);
  },
  async 'delete-notification'(flags) {
    return api.deleteNotification(url(flags), token(flags), requireFlag(flags, 'id'), flags.as);
  },
  async 'mark-all-notifications-read'(flags) {
    return api.markAllNotificationsRead(url(flags), token(flags), flags.as);
  },

  // Form View Config (internal)
  async 'get-form-view'(flags) {
    return api.formViewGet(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), flags.as);
  },
  async 'update-form-view'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.formViewUpdate(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data, flags.as);
  },
  async 'update-form-column'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.formColumnUpdate(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data, flags.as);
  },

  // Gallery View Config
  async 'get-gallery-view'(flags) {
    return api.getGalleryView(url(flags), token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), flags.as);
  },
  async 'update-gallery-view'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.galleryViewUpdate(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data, flags.as);
  },

  // Kanban View Config
  async 'get-kanban-view'(flags) {
    return api.getKanbanView(url(flags), token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), flags.as);
  },
  async 'update-kanban-view'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.kanbanViewUpdate(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data, flags.as);
  },

  // Grid View Config
  async 'list-grid-columns'(flags) {
    return api.listGridColumns(url(flags), token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), flags.as);
  },
  async 'update-grid-column'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.gridColumnUpdate(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data, flags.as);
  },

  // Map View Config (internal)
  async 'get-map-view'(flags) {
    return api.mapViewGet(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), flags.as);
  },
  async 'update-map-view'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.mapViewUpdate(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data, flags.as);
  },

  // Calendar Data
  async 'calendar-data'(flags) {
    const params: Record<string, string | number | undefined> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (k.startsWith('param-')) params[k.slice(6)] = v;
    }
    return api.calendarData(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'view-name'),
      Object.keys(params).length ? params : undefined,
      flags.as,
    );
  },
  async 'calendar-count-by-date'(flags) {
    const params: Record<string, string | number | undefined> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (k.startsWith('param-')) params[k.slice(6)] = v;
    }
    return api.calendarCountByDate(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'table'),
      requireFlag(flags, 'view-name'),
      Object.keys(params).length ? params : undefined,
      flags.as,
    );
  },

  // Base Users / Collaborators (v1)
  async 'list-base-users'(flags) {
    return api.listBaseUsers(url(flags), token(flags), requireFlag(flags, 'base'), flags.as);
  },
  async 'invite-base-user'(flags) {
    return api.inviteBaseUser(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'email'),
      requireFlag(flags, 'roles'),
      flags.as,
    );
  },
  async 'update-base-user'(flags) {
    return api.updateBaseUser(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'user-id'),
      requireFlag(flags, 'roles'),
      flags.as,
    );
  },
  async 'remove-base-user'(flags) {
    return api.removeBaseUser(url(flags), token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'user-id'), flags.as);
  },

  // Extensions (internal)
  async 'list-extensions'(flags) {
    return api.extensionList(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), flags.as);
  },
  async 'get-extension'(flags) {
    return api.extensionRead(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), flags.as);
  },
  async 'create-extension'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.extensionCreate(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), data, flags.as);
  },
  async 'update-extension'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.extensionUpdate(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data, flags.as);
  },
  async 'delete-extension'(flags) {
    return api.extensionDelete(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), flags.as);
  },

  // Integrations
  async 'list-integrations'(flags) {
    return api.listIntegrations(url(flags), token(flags), await wsId(flags), flags.as);
  },
  async 'get-integration'(flags) {
    return api.getIntegration(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'id'), flags.as);
  },
  async 'create-integration'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.createIntegration(url(flags), token(flags), await wsId(flags), data, flags.as);
  },
  async 'update-integration'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.updateIntegration(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'id'), data, flags.as);
  },
  async 'delete-integration'(flags) {
    return api.deleteIntegration(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'id'), flags.as);
  },

  // Sources / Data Sources
  async 'list-sources'(flags) {
    return api.listSources(url(flags), token(flags), requireFlag(flags, 'base'), flags.as);
  },
  async 'get-source'(flags) {
    return api.getSource(url(flags), token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), flags.as);
  },
  async 'update-source'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.updateSource(url(flags), token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data, flags.as);
  },

  // Snapshots (EE)
  async 'list-snapshots'(flags) {
    return api.listSnapshots(url(flags), token(flags), requireFlag(flags, 'base'), flags.as);
  },
  async 'update-snapshot'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.updateSnapshot(url(flags), token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), data, flags.as);
  },
  async 'delete-snapshot'(flags) {
    return api.deleteSnapshot(url(flags), token(flags), requireFlag(flags, 'base'), requireFlag(flags, 'id'), flags.as);
  },

  // Plugins
  async 'list-plugins'(flags) {
    return api.listPlugins(url(flags), token(flags), flags.as);
  },
  async 'get-plugin'(flags) {
    return api.getPlugin(url(flags), token(flags), requireFlag(flags, 'id'), flags.as);
  },
  async 'update-plugin'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.updatePlugin(url(flags), token(flags), requireFlag(flags, 'id'), data, flags.as);
  },
  async 'test-plugin'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.testPlugin(url(flags), token(flags), data, flags.as);
  },

  // Model Visibilities / UI ACL
  async 'get-visibility-rules'(flags) {
    return api.getVisibilityRules(url(flags), token(flags), requireFlag(flags, 'base'), flags.as);
  },
  async 'set-visibility-rules'(flags) {
    const rules = parseJson(requireFlag(flags, 'data'));
    return api.setVisibilityRules(url(flags), token(flags), requireFlag(flags, 'base'), rules, flags.as);
  },

  // Org Users
  async 'list-org-users'(flags) {
    return api.listOrgUsers(url(flags), token(flags), await wsId(flags), undefined, flags.as);
  },
  async 'create-org-user'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.createOrgUser(url(flags), token(flags), await wsId(flags), data, flags.as);
  },
  async 'update-org-user'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.updateOrgUser(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'id'), data, flags.as);
  },
  async 'delete-org-user'(flags) {
    return api.deleteOrgUser(url(flags), token(flags), await wsId(flags), requireFlag(flags, 'id'), flags.as);
  },

  // Org Tokens
  async 'list-org-tokens'(flags) {
    return api.listOrgTokens(url(flags), token(flags), flags.as);
  },
  async 'create-org-token'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.createOrgToken(url(flags), token(flags), data, flags.as);
  },
  async 'delete-org-token'(flags) {
    return api.deleteOrgToken(url(flags), token(flags), requireFlag(flags, 'id'), flags.as);
  },

  // Jobs
  async 'list-jobs'(flags) {
    const filter = flags.data ? parseJson(flags.data) as Record<string, unknown> : undefined;
    return api.listJobs(url(flags), token(flags), requireFlag(flags, 'base'), filter, flags.as);
  },

  // Swagger
  async swagger(flags) {
    return api.getSwagger(url(flags), token(flags), requireFlag(flags, 'base'), flags.as);
  },

  // App Info
  async 'app-info'(flags) {
    return api.appInfo(url(flags), token(flags), flags.as);
  },
  async 'test-connection'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.testConnection(url(flags), token(flags), data, flags.as);
  },

  // Cache
  async 'get-cache'(flags) {
    return api.getCache(url(flags), token(flags), flags.as);
  },
  async 'clear-cache'(flags) {
    return api.clearCache(url(flags), token(flags), flags.as);
  },

  // User Profile
  async 'update-profile'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.updateProfile(url(flags), token(flags), data, flags.as);
  },

  // SQL View
  async 'create-sql-view'(flags) {
    const data = parseJson(requireFlag(flags, 'data')) as Record<string, unknown>;
    return api.createSqlView(
      url(flags),
      token(flags),
      requireFlag(flags, 'base'),
      requireFlag(flags, 'source'),
      data,
      flags.as,
    );
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
      usage: 'npx tsx cli.ts <command> --url=<NocoDB URL> [--as=<email>] [--flags]',
      commands: Object.keys(commands).sort(),
      flags: {
        '--url': 'NocoDB URL (required on every command)',
        '--as': 'Email to authenticate as (required on authenticated commands)',
        '--base': 'Base ID (required for table/field/view/record commands)',
        '--table': 'Table ID (required for field/view/record commands)',
        '--workspace': 'Workspace ID (auto-resolved from --base if omitted)',
        '--view': 'View ID (required for filter/sort/view-column commands)',
      },
      workflow: 'Entry point: signin → list-workspaces → list-bases → work with resources',
      raw: 'Use "raw" command for arbitrary API calls: raw --url=... --method=POST --path=/api/v3/... --data=\'{"key":"val"}\' --as=user@example.com',
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
