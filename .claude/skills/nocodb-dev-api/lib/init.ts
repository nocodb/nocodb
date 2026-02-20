import type { State, Role } from './types.js';
import { ROLES, TEST_USERS, WORKSPACE_ROLES } from './types.js';
import { readState, writeState, getBaseUrl } from './state.js';
import * as api from './api.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const WORKSPACE_TITLE = 'Agent Workspace';

// ---------------------------------------------------------------------------
// Data file helpers
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

function loadDataFile(name: string): Record<string, unknown>[] {
  return JSON.parse(readFileSync(join(DATA_DIR, name), 'utf8'));
}

// ---------------------------------------------------------------------------
// Ensure all 5 test users exist (try signin, fallback to signup)
// ---------------------------------------------------------------------------

async function ensureUsers(): Promise<Record<string, string>> {
  const tokens: Record<string, string> = {};
  for (const role of ROLES) {
    const { email, password } = TEST_USERS[role];
    try {
      const res = await api.signin(email, password);
      tokens[role] = res.token;
    } catch {
      try {
        const res = await api.signup(email, password);
        tokens[role] = res.token;
      } catch (e) {
        throw new Error(`Failed to signin/signup ${role} (${email}): ${e}`);
      }
    }
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Ensure "Agent Workspace" exists (find or create)
// ---------------------------------------------------------------------------

async function ensureWorkspace(
  ownerToken: string,
): Promise<{ id: string; title: string }> {
  const { list } = await api.listWorkspaces(ownerToken);
  const existing = list.find((ws) => ws.title === WORKSPACE_TITLE);
  if (existing) return { id: existing.id, title: existing.title };
  const ws = await api.createWorkspace(ownerToken, WORKSPACE_TITLE);
  return { id: ws.id, title: ws.title };
}

// ---------------------------------------------------------------------------
// Ensure non-owner users are invited with correct roles
// ---------------------------------------------------------------------------

async function ensureRoles(
  ownerToken: string,
  wsId: string,
  tokens: Record<string, string>,
): Promise<void> {
  const { list } = await api.listWorkspaceUsers(ownerToken, wsId);
  const invitedEmails = new Set(list.map((u) => u.email));

  for (const role of ROLES) {
    if (role === 'owner') continue;
    const { email } = TEST_USERS[role];
    if (invitedEmails.has(email)) continue;

    try {
      await api.inviteToWorkspace(ownerToken, wsId, email, WORKSPACE_ROLES[role]);
    } catch (e) {
      throw new Error(`Failed to invite ${role} (${email}): ${e}`);
    }

    // Accept by re-signing in as the invited user (refreshes their workspace list)
    try {
      const { email: e, password: p } = TEST_USERS[role];
      const res = await api.signin(e, p);
      tokens[role] = res.token;
    } catch {
      // Token already exists from ensureUsers, invitation will take effect on next use
    }
  }
}

// ---------------------------------------------------------------------------
// Sample data — mirrors workspace wmjhal84 from pr-8053.nocopod.com
// ---------------------------------------------------------------------------

const BASE_TITLE = 'Getting Started';

type FieldDef = { title: string; type: string; options?: Record<string, unknown> };

const FINANCIAL_FIELDS: FieldDef[] = [
  { title: 'Segment', type: 'SingleLineText' },
  { title: 'Country', type: 'SingleSelect', options: { choices: ['France', 'Germany', 'Canada', 'United States of America', 'Mexico'] } },
  { title: 'Product', type: 'SingleSelect', options: { choices: ['Carretera', 'Montana', 'Velo', 'Paseo', 'VTT', 'Amarilla'] } },
  { title: 'Discount Band', type: 'SingleSelect', options: { choices: ['High', 'None', 'Medium', 'Low'] } },
  { title: 'Units Sold', type: 'Number' },
  { title: 'Manufacturing Price', type: 'Currency', options: { currency_locale: 'en-US', currency_code: 'USD' } },
  { title: 'Sale Price', type: 'Currency', options: { currency_locale: 'en-US', currency_code: 'USD' } },
  { title: 'Gross Sales', type: 'Currency', options: { currency_locale: 'en-US', currency_code: 'USD' } },
  { title: 'Discounts', type: 'SingleLineText' },
  { title: 'Sales', type: 'Currency', options: { currency_locale: 'en-US', currency_code: 'USD' } },
  { title: 'COGS', type: 'Currency', options: { currency_locale: 'en-US', currency_code: 'USD' } },
  { title: 'Profit', type: 'SingleLineText' },
  { title: 'Date', type: 'Date', options: { date_format: 'YYYY-MM-DD' } },
  { title: 'Month Number', type: 'SingleLineText' },
  { title: 'Month Name', type: 'SingleLineText' },
  { title: 'Year', type: 'SingleLineText' },
];

const ALL_TYPES_FIELDS: FieldDef[] = [
  { title: 'fNumber', type: 'Number' },
  { title: 'fDecimal', type: 'Decimal', options: { precision: 3, locale_string: true } },
  { title: 'fCurrency', type: 'Currency', options: { currency_locale: 'en-GB', currency_code: 'USD' } },
  { title: 'fPercent (progress)', type: 'Percent', options: { show_as_progress: true } },
  { title: 'fPercent', type: 'Percent' },
  { title: 'fDuration', type: 'Duration', options: { duration_format: 'h:mm:ss.s' } },
  { title: 'fRating', type: 'Rating', options: { color: '#dc2f02', max_value: 7, icon: 'heart' } },
  { title: 'fRating2', type: 'Rating', options: { color: '#1FAB51', max_value: 10, icon: 'circle-filled' } },
  { title: 'fYear', type: 'Year' },
  { title: 'fTime', type: 'Time' },
  { title: 'fSingleLineText', type: 'SingleLineText' },
  { title: 'fMultiLineText', type: 'LongText' },
  { title: 'fEmail', type: 'Email', options: { validate: true } },
  { title: 'fPhoneNumber', type: 'PhoneNumber', options: { validate: true } },
  { title: 'fURL', type: 'URL', options: { validate: true } },
  { title: 'fSingleSelect', type: 'SingleSelect', options: { choices: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] } },
  { title: 'fMultiSelect', type: 'MultiSelect', options: { choices: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] } },
  { title: 'fCheckbox', type: 'Checkbox', options: { color: '#dc2f02', icon: 'star' } },
  { title: 'fDate2', type: 'Date', options: { date_format: 'YYYY/MM/DD' } },
  { title: 'fDate', type: 'Date', options: { date_format: 'DD MM YYYY' } },
  { title: 'fDateTime', type: 'DateTime', options: { date_format: 'YYYY-MM-DD', time_format: 'HH:mm' } },
  { title: 'fAttachment', type: 'Attachment' },
  { title: 'fJSON', type: 'JSON' },
  { title: 'fGeometry', type: 'Geometry' },
  { title: 'fUser', type: 'User' },
  { title: 'fRichText', type: 'LongText', options: { rich_text: true } },
  { title: 'Tags', type: 'MultiSelect', options: { choices: ['jan', 'feb', 'mar', 'apr'] } },
];

/** Build select options with dtxp for createField */
function selectDtxp(choices: string[]): string {
  return choices.map((c) => `'${c}'`).join(',');
}

async function createTableWithFields(
  token: string,
  baseId: string,
  title: string,
  fields: FieldDef[],
): Promise<{ tableId: string; fieldIds: Record<string, string> }> {
  const table = (await api.createTable(token, baseId, title, [])) as any;
  const tableId: string = table.id;
  const fieldIds: Record<string, string> = {};

  for (const f of fields) {
    const payload: Record<string, unknown> = { title: f.title, uidt: f.type };
    if (f.type === 'SingleSelect' || f.type === 'MultiSelect') {
      const choices = (f.options?.choices || []) as string[];
      payload.dtxp = selectDtxp(choices);
    }
    if (f.options) {
      for (const [k, v] of Object.entries(f.options)) {
        if (k !== 'choices') payload[k] = v;
      }
    }
    const col = (await api.createField(token, baseId, tableId, payload)) as any;
    fieldIds[f.title] = col.id;
  }

  return { tableId, fieldIds };
}

/** Bulk insert records in chunks (v3 API caps at ~100 per request) */
async function bulkInsertRecords(
  token: string,
  baseId: string,
  tableId: string,
  records: Record<string, unknown>[],
  chunkSize = 100,
): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    await api.createRecords(token, baseId, tableId, chunk);
    inserted += chunk.length;
  }
  return inserted;
}

export async function ensureSampleData(): Promise<unknown> {
  const state = readState();
  if (!state) throw new Error('Not initialized. Run init first.');
  const token = state.tokens.owner;
  const wsId = state.workspace!.id;

  // Find or create "Getting Started" base
  const { list: bases } = await api.listBases(token, wsId);
  let base = bases.find((b) => b.title === BASE_TITLE);
  if (!base) {
    base = (await api.createBase(token, wsId, BASE_TITLE)) as any;
  }
  const baseId: string = base!.id;

  // Check existing tables
  const { list: existingTables } = await api.listTables(token, baseId);
  const tableNames = new Set(existingTables.map((t) => t.title));

  const result: Record<string, unknown> = { baseId, tables: {} as Record<string, unknown> };

  // 1. AllTypes table — all field types, 110 records
  if (!tableNames.has('AllTypes')) {
    const { tableId, fieldIds } = await createTableWithFields(token, baseId, 'AllTypes', ALL_TYPES_FIELDS);

    const records = loadDataFile('all-types.json');
    const count = await bulkInsertRecords(token, baseId, tableId, records);

    // Create views: Grid variants, Gallery, Kanban, Calendar, Form
    await api.createView(token, wsId, baseId, tableId, 'Show system fields', 'grid');
    await api.createView(token, wsId, baseId, tableId, 'Group By', 'grid');
    await api.createView(token, wsId, baseId, tableId, 'Active Toolbar', 'grid');
    await api.createView(token, wsId, baseId, tableId, 'Footer aggregations', 'grid');
    await api.createView(token, wsId, baseId, tableId, 'Gallery', 'gallery');
    await api.createView(token, wsId, baseId, tableId, 'Kanban', 'kanban');
    await api.createView(token, wsId, baseId, tableId, 'Calendar', 'calendar');
    await api.createView(token, wsId, baseId, tableId, 'Grid', 'grid');
    await api.createView(token, wsId, baseId, tableId, 'Form', 'form');

    (result.tables as any).AllTypes = { tableId, fieldIds, recordCount: count };
  } else {
    const t = existingTables.find((t) => t.title === 'AllTypes')!;
    (result.tables as any).AllTypes = { tableId: t.id, existing: true };
  }

  // Load financial records (shared across 3 tables — 700 rows each)
  const financialRecords = loadDataFile('financial-sample.json');

  // 2. Financial Sample table — 700 records
  if (!tableNames.has('Financial Sample')) {
    const { tableId, fieldIds } = await createTableWithFields(token, baseId, 'Financial Sample', FINANCIAL_FIELDS);
    const count = await bulkInsertRecords(token, baseId, tableId, financialRecords);
    (result.tables as any)['Financial Sample'] = { tableId, fieldIds, recordCount: count };
  } else {
    const t = existingTables.find((t) => t.title === 'Financial Sample')!;
    (result.tables as any)['Financial Sample'] = { tableId: t.id, existing: true };
  }

  // 3. Webhook table (same schema + data as Financial Sample, with hooks)
  if (!tableNames.has('Webhook')) {
    const { tableId, fieldIds } = await createTableWithFields(token, baseId, 'Webhook', FINANCIAL_FIELDS);
    const count = await bulkInsertRecords(token, baseId, tableId, financialRecords);

    // Create webhooks: 3 active (insert/update/delete) + 3 inactive (bulk ops)
    const webhookUrl = 'https://webhook.site/test-placeholder';
    const notification = (method: string) => JSON.stringify({
      type: 'URL', include_user: true,
      payload: { method, body: '{{ json event }}', headers: [], parameters: [], path: webhookUrl, auth: '' },
    });
    const hooks: Array<{ title: string; operation: string; active: boolean }> = [
      { title: 'Webhook-1', operation: 'insert', active: true },
      { title: 'Webhook-2', operation: 'update', active: true },
      { title: 'Webhook-3', operation: 'delete', active: true },
      { title: 'Webhook-4', operation: 'bulkInsert', active: false },
      { title: 'Webhook-5', operation: 'bulkUpdate', active: false },
      { title: 'Webhook-6', operation: 'bulkDelete', active: false },
    ];
    for (const h of hooks) {
      await api.hookCreate(token, wsId, baseId, tableId, {
        title: h.title,
        event: 'after',
        operation: h.operation,
        active: h.active,
        condition: true,
        notification: notification('POST'),
        version: 'v2',
      });
    }

    (result.tables as any).Webhook = { tableId, fieldIds, recordCount: count };
  } else {
    const t = existingTables.find((t) => t.title === 'Webhook')!;
    (result.tables as any).Webhook = { tableId: t.id, existing: true };
  }

  // 4. Permissions table (same schema + data, restricted operations)
  if (!tableNames.has('Permissions')) {
    const { tableId, fieldIds } = await createTableWithFields(token, baseId, 'Permissions', FINANCIAL_FIELDS);
    const count = await bulkInsertRecords(token, baseId, tableId, financialRecords);
    (result.tables as any).Permissions = { tableId, fieldIds, recordCount: count };
  } else {
    const t = existingTables.find((t) => t.title === 'Permissions')!;
    (result.tables as any).Permissions = { tableId: t.id, existing: true };
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main init orchestrator
// ---------------------------------------------------------------------------

export async function init(url?: string): Promise<State> {
  const resolvedUrl = url || process.env.NOCODB_URL || getBaseUrl();

  // Temporarily write state so getBaseUrl() picks up the URL for API calls
  const existingState = readState();
  const state: State = {
    url: resolvedUrl,
    tokens: existingState?.tokens || {},
    workspace: existingState?.workspace || null,
    updatedAt: new Date().toISOString(),
  };
  writeState(state);

  const tokens = await ensureUsers();
  state.tokens = tokens as State['tokens'];
  writeState(state);

  const workspace = await ensureWorkspace(tokens.owner);
  state.workspace = workspace;
  writeState(state);

  await ensureRoles(tokens.owner, workspace.id, tokens);
  state.tokens = tokens as State['tokens'];
  writeState(state);

  return state;
}
