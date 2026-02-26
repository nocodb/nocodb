import { ROLES, TEST_USERS, WORKSPACE_ROLES, normalizeEmail } from '../../lib/types.js';
import { storeCredential, getCredential } from '../../lib/credentials.js';
import * as api from '../../lib/api.js';
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

export async function ensureUsers(url: string): Promise<void> {
  for (const role of ROLES) {
    const { email, password } = TEST_USERS[role];
    try {
      const res = await api.signin(url, email, password);
      storeCredential(url, email, password, res.token);
    } catch {
      try {
        const res = await api.signup(url, email, password);
        storeCredential(url, email, password, res.token);
      } catch (e) {
        throw new Error(`Failed to signin/signup ${role} (${email}): ${e}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Ensure "Agent Workspace" exists (find or create)
// ---------------------------------------------------------------------------

export async function ensureWorkspace(
  url: string,
  ownerToken: string,
  ownerEmail?: string,
): Promise<{ id: string; title: string }> {
  const { list } = await api.listWorkspaces(url, ownerToken, ownerEmail);
  const existing = list.find((ws) => ws.title === WORKSPACE_TITLE);
  if (existing) return { id: existing.id, title: existing.title };
  const ws = await api.createWorkspace(url, ownerToken, WORKSPACE_TITLE, ownerEmail);
  return { id: ws.id, title: ws.title };
}

// ---------------------------------------------------------------------------
// Ensure non-owner users are invited with correct roles
// ---------------------------------------------------------------------------

export async function ensureRoles(
  url: string,
  ownerToken: string,
  wsId: string,
  ownerEmail?: string,
): Promise<void> {
  const { list } = await api.listWorkspaceUsers(url, ownerToken, wsId, ownerEmail);
  const invitedEmails = new Set(list.map((u) => u.email));

  for (const role of ROLES) {
    if (role === 'owner') continue;
    const { email, password } = TEST_USERS[role];
    if (invitedEmails.has(email)) continue;

    try {
      await api.inviteToWorkspace(url, ownerToken, wsId, email, WORKSPACE_ROLES[role], ownerEmail);
    } catch (e) {
      throw new Error(`Failed to invite ${role} (${email}): ${e}`);
    }

    // Accept by re-signing in as the invited user (refreshes their workspace list)
    try {
      const res = await api.signin(url, email, password);
      storeCredential(url, email, password, res.token);
    } catch {
      // Token already exists from ensureUsers, invitation will take effect on next use
    }
  }
}

// ---------------------------------------------------------------------------
// Sample data — replica of workspace wmjhal84 on develop.nocopod.com
// ---------------------------------------------------------------------------

type FieldDef = { title: string; type: string; options?: Record<string, unknown> };

/** NocoDB standard select-option palette (same order as the UI) */
const SELECT_COLORS = [
  '#cfdffe', '#d0f1fd', '#c2f5e8', '#ffdaf6', '#ffdce5',
  '#fee2d5', '#ffeab6', '#d4f7dc', '#cff5f6', '#ede2fe',
  '#fce3e5', '#eee7df',
];

/** Convert FieldDef options to v3 API format.
 *  Auto-assigns palette colors to select choices (API doesn't auto-color). */
function toV3Payload(f: FieldDef): { title: string; type: string; [k: string]: unknown } {
  const payload: { title: string; type: string; [k: string]: unknown } = { title: f.title, type: f.type };
  if (f.options) {
    const opts: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(f.options)) {
      if (k === 'choices') {
        opts.choices = (v as string[]).map((c, i) => ({
          title: c,
          color: SELECT_COLORS[i % SELECT_COLORS.length],
        }));
      } else {
        opts[k] = v;
      }
    }
    payload.options = opts;
  }
  return payload;
}

/** Create a field, return its id. Throws on failure. */
async function addField(
  url: string,
  token: string,
  baseId: string,
  tableId: string,
  f: FieldDef,
  email?: string,
): Promise<string> {
  const col = await api.createField(url, token, baseId, tableId, toV3Payload(f), email);
  return col.id;
}

/** Try to create a field; swallow errors for non-critical computed fields. */
async function tryAddField(
  url: string,
  token: string,
  baseId: string,
  tableId: string,
  f: FieldDef,
  email?: string,
): Promise<string | null> {
  try {
    return await addField(url, token, baseId, tableId, f, email);
  } catch (e) {
    process.stderr.write(`[warn] skipping field "${f.title}" (${f.type}): ${(e as Error).message}\n`);
    return null;
  }
}

/** Convert numeric duration (seconds) to h:mm:ss string for the API */
function durationToString(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Preprocess records: convert types the v1 bulk API can't handle (e.g. numeric Duration) */
function preprocessRecords(
  records: Record<string, unknown>[],
  durationFields: string[],
): Record<string, unknown>[] {
  if (!durationFields.length) return records;
  return records.map((r) => {
    const copy = { ...r };
    for (const field of durationFields) {
      if (typeof copy[field] === 'number') {
        copy[field] = durationToString(copy[field] as number);
      }
    }
    return copy;
  });
}

/** Bulk insert records in chunks via v1 bulk API (no 10-record limit) */
async function bulkInsertRecords(
  url: string,
  token: string,
  baseId: string,
  tableId: string,
  records: Record<string, unknown>[],
  email?: string,
  chunkSize = 100,
): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    await api.bulkInsert(url, token, baseId, tableId, chunk, email);
    inserted += chunk.length;
  }
  return inserted;
}

// ---------------------------------------------------------------------------
// Field definitions — matching develop.nocopod.com wmjhal84
// ---------------------------------------------------------------------------

const ALLTYPES_DATA_FIELDS: FieldDef[] = [
  { title: 'fNumber', type: 'Number' },
  { title: 'fDecimal', type: 'Decimal', options: { precision: 3 } },
  { title: 'fCurrency', type: 'Currency', options: { locale: 'en-GB', code: 'USD' } },
  { title: 'fPercent (progress)', type: 'Percent', options: { show_as_progress: true } },
  { title: 'fPercent', type: 'Percent' },
  { title: 'fDuration', type: 'Duration', options: { duration_format: 'h:mm:ss.s' } },
  { title: 'fRating', type: 'Rating', options: { color: '#dc2f02', max_value: 7, icon: 'heart' } },
  { title: 'fRating2', type: 'Rating', options: { color: '#1FAB51', max_value: 10, icon: 'circle-filled' } },
  { title: 'fYear', type: 'Year' },
  { title: 'fTime', type: 'Time' },
  { title: 'fSingleLineText', type: 'SingleLineText' },
  { title: 'fMultiLineText', type: 'LongText' },
  { title: 'fEmail', type: 'Email', options: { validation: true } },
  { title: 'fPhoneNumber', type: 'PhoneNumber', options: { validation: true } },
  { title: 'fURL', type: 'URL', options: { validation: true } },
  { title: 'fSingleSelect', type: 'SingleSelect', options: { choices: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] } },
  { title: 'fMultiSelect', type: 'MultiSelect', options: { choices: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] } },
  { title: 'fCheckbox', type: 'Checkbox', options: { color: '#dc2f02', icon: 'star' } },
  { title: 'fDate2', type: 'Date', options: { date_format: 'YYYY/MM/DD' } },
  { title: 'fDate', type: 'Date', options: { date_format: 'DD MM YYYY' } },
  { title: 'fDateTime', type: 'DateTime', options: { date_format: 'YYYY-MM-DD', time_format: 'HH:mm' } },
  { title: 'fJSON', type: 'JSON' },
  { title: 'fRichText', type: 'LongText', options: { rich_text: true } },
  { title: 'Tags', type: 'MultiSelect', options: { choices: ['jan', 'feb', 'mar', 'apr'] } },
];

const ALLTYPES_EMPTY_FIELDS: FieldDef[] = [
  { title: 'fAttachment', type: 'Attachment' },
  { title: 'fGeometry', type: 'Geometry' },
  { title: 'fUser', type: 'User' },
];

const ALLTYPES_SYSTEM_FIELDS: FieldDef[] = [
  { title: 'fCreatedAt', type: 'CreatedTime' },
  { title: 'fLastModifiedAt', type: 'LastModifiedTime' },
  { title: 'fCreatedBy', type: 'CreatedBy' },
  { title: 'fLastModifiedBy', type: 'LastModifiedBy' },
];

const FINANCIAL_FIELDS: FieldDef[] = [
  { title: 'Segment', type: 'SingleLineText' },
  { title: 'Country', type: 'SingleSelect', options: { choices: ['France', 'Germany', 'Canada', 'United States of America', 'Mexico'] } },
  { title: 'Product', type: 'SingleSelect', options: { choices: ['Carretera', 'Montana', 'Velo', 'Paseo', 'VTT', 'Amarilla'] } },
  { title: 'Discount Band', type: 'SingleSelect', options: { choices: ['High', 'None', 'Medium', 'Low'] } },
  { title: 'Units Sold', type: 'Number' },
  { title: 'Manufacturing Price', type: 'Currency', options: { locale: 'en-US', code: 'USD' } },
  { title: 'Sale Price', type: 'Currency', options: { locale: 'en-US', code: 'USD' } },
  { title: 'Gross Sales', type: 'Currency', options: { locale: 'en-US', code: 'USD' } },
  { title: 'Discounts', type: 'SingleLineText' },
  { title: 'Sales', type: 'Currency', options: { locale: 'en-US', code: 'USD' } },
  { title: 'COGS', type: 'Currency', options: { locale: 'en-US', code: 'USD' } },
  { title: 'Profit', type: 'SingleLineText' },
  { title: 'Date', type: 'Date', options: { date_format: 'YYYY-MM-DD' } },
  { title: 'Month Number', type: 'SingleLineText' },
  { title: 'Month Name', type: 'SingleLineText' },
  { title: 'Year', type: 'SingleLineText' },
];

const SCRIPT_BOILERPLATE = `// Welcome to NocoDB Scripts!
// This is a simple example to get you started.

// Get your table
const table = await input.tableAsync("Select a table");

// Get all records from the table
const query = await table.selectRecordsAsync();

// Display how many records you have
output.text(\`You have \${query.records.length} records in this table.\`);

// Show the first record as an example
if (query.records.length > 0) {
    let firstRecord = query.records[0];
    output.text(\`First record: \${firstRecord.name || firstRecord.id}\`);
}

// That's it! You've just read data from your table.
// Try changing the table name above and run the script again.`;

// ---------------------------------------------------------------------------
// AllTypes table — complex field creation
// ---------------------------------------------------------------------------

async function createAllTypesTable(
  url: string,
  token: string,
  wsId: string,
  baseId: string,
  email?: string,
): Promise<{ tableId: string; fieldIds: Record<string, string>; recordCount: number }> {
  const table = (await api.createTable(url, token, baseId, 'AllTypes', [], email)) as any;
  const tableId: string = table.id;
  const fieldIds: Record<string, string> = {};

  for (const f of table.fields ?? []) {
    fieldIds[f.title] = f.id;
  }

  // Phase 1: Create data fields
  for (const f of ALLTYPES_DATA_FIELDS) {
    fieldIds[f.title] = await addField(url, token, baseId, tableId, f, email);
  }

  // Set fNumber as display value
  if (fieldIds['fNumber']) {
    await api.columnSetAsPrimary(url, token, wsId, baseId, fieldIds['fNumber'], email);
  }

  // Phase 2: Insert records
  const rawRecords = loadDataFile('all-types.json');
  const records = preprocessRecords(rawRecords, ['fDuration']);
  const recordCount = await bulkInsertRecords(url, token, baseId, tableId, records, email);

  // Phase 3: Non-data basic fields
  for (const f of ALLTYPES_EMPTY_FIELDS) {
    const id = await tryAddField(url, token, baseId, tableId, f, email);
    if (id) fieldIds[f.title] = id;
  }

  // Phase 4: Button field
  const btnId = await tryAddField(url, token, baseId, tableId, {
    title: 'fButton', type: 'Button',
    options: { type: 'formula', formula: '"www.google.com"' },
  }, email);
  if (btnId) fieldIds['fButton'] = btnId;

  // Phase 5: System-like fields
  for (const f of ALLTYPES_SYSTEM_FIELDS) {
    const id = await tryAddField(url, token, baseId, tableId, f, email);
    if (id) fieldIds[f.title] = id;
  }

  // Phase 6: Barcode & QrCode
  const fNumberId = fieldIds['fNumber'];
  if (fNumberId) {
    const barcodeId = await tryAddField(url, token, baseId, tableId, {
      title: 'fBarcode', type: 'Barcode',
      options: { barcode_value_field_id: fNumberId },
    }, email);
    if (barcodeId) fieldIds['fBarcode'] = barcodeId;

    const qrId = await tryAddField(url, token, baseId, tableId, {
      title: 'fQRCode', type: 'QrCode',
      options: { qrcode_value_field_id: fNumberId },
    }, email);
    if (qrId) fieldIds['fQRCode'] = qrId;
  }

  // Phase 7: Formula
  const formulaId = await tryAddField(url, token, baseId, tableId, {
    title: 'fFormula', type: 'Formula',
    options: { formula: '{fNumber}+{fDecimal}' },
  }, email);
  if (formulaId) fieldIds['fFormula'] = formulaId;

  // Phase 8: Self-referencing Links
  const mmLinksId = await tryAddField(url, token, baseId, tableId, {
    title: 'mmLinks', type: 'Links',
    options: { related_table_id: tableId, relation_type: 'mm' },
  }, email);
  if (mmLinksId) fieldIds['mmLinks'] = mmLinksId;

  const hmLinksId = await tryAddField(url, token, baseId, tableId, {
    title: 'hmLinks', type: 'Links',
    options: { related_table_id: tableId, relation_type: 'hm' },
  }, email);
  if (hmLinksId) fieldIds['hmLinks'] = hmLinksId;

  // Phase 9: Lookup & Rollup
  if (hmLinksId && fNumberId) {
    const lookupId = await tryAddField(url, token, baseId, tableId, {
      title: 'fLookup', type: 'Lookup',
      options: { related_field_id: hmLinksId, related_table_lookup_field_id: fNumberId },
    }, email);
    if (lookupId) fieldIds['fLookup'] = lookupId;

    const fDecimalId = fieldIds['fDecimal'];
    if (fDecimalId) {
      const rollupId = await tryAddField(url, token, baseId, tableId, {
        title: 'fRollup', type: 'Rollup',
        options: { related_field_id: hmLinksId, related_table_rollup_field_id: fDecimalId, rollup_function: 'count' },
      }, email);
      if (rollupId) fieldIds['fRollup'] = rollupId;
    }
  }

  // Phase 10: Create views
  const views = [
    { title: 'Show system fields', type: 'grid' },
    { title: 'Group By', type: 'grid' },
    { title: 'Active Toolbar', type: 'grid' },
    { title: 'Footer aggregations', type: 'grid' },
    { title: 'Gallery', type: 'gallery' },
    { title: 'Kanban', type: 'kanban' },
    { title: 'Calendar', type: 'calendar' },
    { title: 'Grid', type: 'grid' },
    { title: 'Form', type: 'form' },
  ];
  for (const v of views) {
    try {
      await api.createView(url, token, wsId, baseId, tableId, v.title, v.type, email);
    } catch (e) {
      process.stderr.write(`[warn] skipping view "${v.title}": ${(e as Error).message}\n`);
    }
  }

  return { tableId, fieldIds, recordCount };
}

// ---------------------------------------------------------------------------
// Financial table creator
// ---------------------------------------------------------------------------

async function createFinancialTable(
  url: string,
  token: string,
  baseId: string,
  title: string,
  records: Record<string, unknown>[],
  email?: string,
): Promise<{ tableId: string; fieldIds: Record<string, string>; recordCount: number }> {
  const table = (await api.createTable(url, token, baseId, title, [
    { title: 'Segment', type: 'SingleLineText', pv: true },
  ], email)) as any;
  const tableId: string = table.id;
  const fieldIds: Record<string, string> = {};

  for (const f of table.fields ?? []) {
    fieldIds[f.title] = f.id;
  }

  for (const f of FINANCIAL_FIELDS) {
    if (f.title === 'Segment') continue;
    fieldIds[f.title] = await addField(url, token, baseId, tableId, f, email);
  }

  const recordCount = await bulkInsertRecords(url, token, baseId, tableId, records, email);
  return { tableId, fieldIds, recordCount };
}

// ---------------------------------------------------------------------------
// ensureSampleData
// ---------------------------------------------------------------------------

export async function ensureSampleData(url: string): Promise<unknown> {
  const ownerEmail = normalizeEmail('owner@agent.test');
  const cred = getCredential(url, ownerEmail);
  if (!cred) throw new Error('No owner credential. Run init first.');
  const token = cred.token;

  // Discover workspace
  const { list: workspaces } = await api.listWorkspaces(url, token, ownerEmail);
  const ws = workspaces.find((w) => w.title === WORKSPACE_TITLE);
  if (!ws) throw new Error('No "Agent Workspace" found. Run init first.');
  const wsId = ws.id;

  // Delete ALL existing bases in workspace (clean slate)
  const { list: existingBases } = await api.listBases(url, token, wsId, ownerEmail);
  for (const b of existingBases) {
    await api.deleteBase(url, token, b.id, ownerEmail);
  }

  // Create fresh "Getting Started" base
  const base = await api.createBase(url, token, wsId, 'Getting Started', ownerEmail);
  const baseId: string = base.id;

  // Create empty "Private" base
  await api.createBase(url, token, wsId, 'Private', ownerEmail);

  const result: Record<string, unknown> = { baseId, tables: {} as Record<string, unknown> };

  // 1. AllTypes
  const allTypes = await createAllTypesTable(url, token, wsId, baseId, ownerEmail);
  (result.tables as any).AllTypes = allTypes;

  // Load financial records
  const financialRecords = loadDataFile('financial-sample.json');

  // 2. Financial Sample
  const finSample = await createFinancialTable(url, token, baseId, 'Financial Sample', financialRecords, ownerEmail);
  (result.tables as any)['Financial Sample'] = finSample;

  // 3. Webhook
  const webhook = await createFinancialTable(url, token, baseId, 'Webhook', financialRecords, ownerEmail);
  (result.tables as any).Webhook = webhook;

  // 4. Permissions
  const permissions = await createFinancialTable(url, token, baseId, 'Permissions', financialRecords, ownerEmail);
  (result.tables as any).Permissions = permissions;

  // 5. Dashboard
  try {
    await api.iPostExported(url, token, wsId, baseId, 'dashboardCreate', { title: 'Dashboard' }, undefined, ownerEmail);
    (result as any).dashboard = true;
  } catch (e) {
    process.stderr.write(`[warn] skipping dashboard: ${(e as Error).message}\n`);
  }

  // 6. Scripts
  const scriptNames = ['Script', 'Script-1', 'Script-2'];
  for (const title of scriptNames) {
    try {
      await api.createScript(url, token, wsId, baseId, {
        title,
        script: SCRIPT_BOILERPLATE,
        config: {},
        meta: {},
      }, ownerEmail);
    } catch (e) {
      process.stderr.write(`[warn] skipping script "${title}": ${(e as Error).message}\n`);
    }
  }
  (result as any).scripts = scriptNames;

  return result;
}

// ---------------------------------------------------------------------------
// Main init orchestrator
// ---------------------------------------------------------------------------

export async function init(url: string): Promise<{ url: string; workspace: { id: string; title: string } }> {
  const ownerEmail = normalizeEmail('owner@agent.test');

  await ensureUsers(url);

  const cred = getCredential(url, ownerEmail);
  if (!cred) throw new Error('Owner credential missing after ensureUsers.');
  const ownerToken = cred.token;

  const workspace = await ensureWorkspace(url, ownerToken, ownerEmail);

  await ensureRoles(url, ownerToken, workspace.id, ownerEmail);

  // Remove auto-created bases on fresh workspace (clean slate for sample-data)
  const { list: bases } = await api.listBases(url, ownerToken, workspace.id, ownerEmail);
  for (const b of bases) {
    await api.deleteBase(url, ownerToken, b.id, ownerEmail);
  }

  return { url, workspace };
}
