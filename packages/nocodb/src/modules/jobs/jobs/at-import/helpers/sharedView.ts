import { AirtableImportIssueCategory } from 'nocodb-sdk';
import type { AtRecordSource } from './readAndProcessData';

// Airtable shared-view import.
//
// A shared view's payload carries one table — its schema, the shared view and
// its rows — in Airtable's internal format. The import pipeline is built for a
// shared base (schema) plus the Airtable API (records), so this adapter turns
// the payload into a one-table `tableSchemas` and serves the rows through an
// `atBase` stand-in, in the API's record format.
//
// Linked tables are not part of the payload, so links, lookups, rollups,
// counts and formulas become plain columns holding the values Airtable shows.

const PAGE_SIZE = 100;

export interface SharedViewApproximation {
  field: string;
  airtable_type: string;
  category: AirtableImportIssueCategory;
  reason: string;
}

export interface SharedViewImport {
  tableSchemas: any[];
  view: any;
  rowCount: number;
  // rows Airtable listed in the view but left out of the payload
  missingRowCount: number;
  approximations: SharedViewApproximation[];
  atBase: AtRecordSource;
}

// Types the pipeline maps on its own; anything else is imported as text.
const KNOWN_TYPES = new Set([
  'foreignKey',
  'text',
  'multilineText',
  'richText',
  'multipleAttachment',
  'checkbox',
  'multiSelect',
  'select',
  'collaborator',
  'multiCollaborator',
  'date',
  'phone',
  'number',
  'rating',
  'formula',
  'rollup',
  'count',
  'lookup',
  'autoNumber',
  'barcode',
  'button',
  'computation',
]);

const DISPLAY_SEPARATOR = ', ';

// Airtable hides the real table name from view shares; the view name is the
// only name the viewer sees.
const MASKED_TABLE_NAME = 'Shared view table';

export const isSharedViewPayload = (payload: any) =>
  !!payload?.table?.columns && !payload?.tableSchemas;

export function buildSharedViewImport(payload: any): SharedViewImport {
  const table = payload.table;
  const view = table.views?.[0] ?? {
    id: undefined,
    name: 'Grid',
    type: 'grid',
  };
  const userInfoById =
    table.appBlanket?.userInfoById ?? payload.appBlanket?.userInfoById ?? {};
  const signedUrls: Record<string, string> = table.signedUserContentUrls ?? {};

  const approximations: SharedViewApproximation[] = [];
  const columns = [];
  for (const col of table.columns) {
    // Airtable's internal row-order key; the import keeps the view's order
    if (col.type === 'manualSort') continue;
    const { column, approximation } = normalizeColumn(col);
    if (approximation) approximations.push(approximation);
    columns.push(column);
  }
  const sourceById = new Map(
    table.columns.filter((c) => c.type !== 'manualSort').map((c) => [c.id, c]),
  );

  // The pipeline names the default view after the table's grid view and only
  // configures grid views; a gallery/kanban/calendar share lands as a grid.
  const sharedView = { ...view, type: 'grid' };
  if (view.type && view.type !== 'grid') {
    approximations.push({
      field: undefined,
      airtable_type: view.type,
      category: AirtableImportIssueCategory.VIEW,
      reason: `shared ${view.type} view imported as a grid view`,
    });
  }

  const tableSchema = {
    id: table.id,
    name:
      table.name === MASKED_TABLE_NAME && view.name ? view.name : table.name,
    description: table.description,
    primaryColumnId: table.primaryColumnId,
    columns,
    views: [sharedView],
  };

  const rows = orderedRows(table, view);
  const payloadIds = new Set((table.rows ?? []).map((r) => r.id));
  const missingRowCount = (view.rowOrder ?? []).filter(
    (r) => r.visibility !== false && !payloadIds.has(r.rowId),
  ).length;

  const ctx: CellCtx = { userInfoById, signedUrls };
  const toRecord = (row) => {
    const fields = {};
    for (const [colId, value] of Object.entries(
      row.cellValuesByColumnId ?? {},
    )) {
      const col: any = sourceById.get(colId);
      if (!col || value === null || value === undefined) continue;
      const converted = toApiValue(col, value, ctx);
      if (converted !== undefined) fields[col.name] = converted;
    }
    return { id: row.id, fields };
  };

  return {
    tableSchemas: [tableSchema],
    view: sharedView,
    rowCount: rows.length,
    missingRowCount,
    approximations,
    atBase: (_tableName: string) => new SharedViewRecords(rows, toRecord),
  };
}

// Airtable's `atBase(table).select(params).eachPage(page, done)`, over the
// payload's rows.
class SharedViewRecords {
  constructor(
    private readonly rows: any[],
    private readonly toRecord: (row: any) => { id: string; fields: any },
  ) {}

  select(_params?: unknown) {
    return this;
  }

  eachPage(
    page: (records: any[], fetchNextPage: () => void) => Promise<void> | void,
    done: (err?: unknown) => Promise<void> | void,
  ) {
    void (async () => {
      try {
        let cursor = 0;
        let next = true;
        while (next && cursor < this.rows.length) {
          next = false;
          const chunk = this.rows
            .slice(cursor, cursor + PAGE_SIZE)
            .map(this.toRecord);
          cursor += PAGE_SIZE;
          await page(chunk, () => {
            next = true;
          });
        }
        await done(undefined);
      } catch (e) {
        await done(e);
      }
    })();
  }
}

export function orderedRows(table: any, view: any) {
  const rows: any[] = table.rows ?? [];
  if (!view?.rowOrder?.length) return rows;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = view.rowOrder
    .filter((r) => r.visibility !== false)
    .map((r) => byId.get(r.rowId))
    .filter(Boolean);
  // rows the view hides stay out; rows the order never mentions are kept
  const listed = new Set(view.rowOrder.map((r) => r.rowId));
  return [...ordered, ...rows.filter((r) => !listed.has(r.id))];
}

function normalizeColumn(col: any): {
  column: any;
  approximation?: SharedViewApproximation;
} {
  const base = {
    id: col.id,
    name: col.name,
    description: col.description,
  };
  const note = (category: AirtableImportIssueCategory, reason: string) => ({
    field: col.name,
    airtable_type: col.type,
    category,
    reason,
  });

  switch (col.type) {
    case 'foreignKey':
      return {
        column: { ...base, type: 'text' },
        approximation: note(
          AirtableImportIssueCategory.LINK,
          'imported as text: a shared view does not include the linked table',
        ),
      };
    case 'lookup':
      return {
        column: { ...base, type: 'multilineText' },
        approximation: note(
          AirtableImportIssueCategory.LOOKUP,
          'imported as text values: a shared view does not include the linked table',
        ),
      };
    case 'rollup':
    case 'count':
      return {
        column: {
          ...base,
          ...resultColumn(col, col.type === 'count' ? 'number' : undefined),
        },
        approximation: note(
          AirtableImportIssueCategory.ROLLUP,
          'imported as static values: a shared view does not include the linked table',
        ),
      };
    case 'formula': {
      const parsed = col.typeOptions?.formulaTextParsed;
      // created / last-modified time keep the pipeline's own mapping
      if (parsed === 'CREATED_TIME()' || parsed === 'LAST_MODIFIED_TIME()')
        return { column: col };
      return {
        column: { ...base, ...resultColumn(col) },
        approximation: note(
          AirtableImportIssueCategory.COLUMN,
          'formula imported as static values',
        ),
      };
    }
    case 'computation':
      if (col.typeOptions?.resultType === 'collaborator')
        return { column: col };
      return {
        column: { ...base, type: 'multilineText' },
        approximation: note(
          AirtableImportIssueCategory.COLUMN,
          'computed field imported as text',
        ),
      };
    default:
      if (KNOWN_TYPES.has(col.type)) return { column: col };
      return {
        column: { ...base, type: 'multilineText' },
        approximation: note(
          AirtableImportIssueCategory.COLUMN,
          `field type '${col.type}' imported as text`,
        ),
      };
  }
}

// A plain column for a computed field, typed after its result.
function resultColumn(col: any, forcedType?: string) {
  const opts = col.typeOptions ?? {};
  switch (forcedType ?? opts.resultType) {
    case 'number':
      return {
        type: 'number',
        typeOptions: {
          format: opts.format,
          precision: opts.precision,
          symbol: opts.symbol,
        },
      };
    case 'date':
      return { type: 'date', typeOptions: { isDateTime: !!opts.isDateTime } };
    case 'checkbox':
      return { type: 'checkbox', typeOptions: {} };
    default:
      return { type: 'multilineText' };
  }
}

export interface CellCtx {
  userInfoById: Record<string, any>;
  signedUrls: Record<string, string>;
}

function choiceName(col: any, id: any) {
  return col.typeOptions?.choices?.[id]?.name ?? id;
}

function collaborator(value: any, ctx: CellCtx) {
  if (value && typeof value === 'object') return value;
  const user = ctx.userInfoById[value];
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  return {
    id: value,
    name: user?.name || fullName || value,
    email: user?.email,
  };
}

// Internal cell value -> the value the Airtable API returns for that field.
export function toApiValue(col: any, value: any, ctx: CellCtx): any {
  switch (col.type) {
    case 'select':
      return choiceName(col, value);
    case 'multiSelect':
      return Array.isArray(value)
        ? value.map((v) => choiceName(col, v))
        : value;
    case 'collaborator':
      return collaborator(value, ctx);
    case 'multiCollaborator':
      return Array.isArray(value)
        ? value.map((v) => collaborator(v, ctx))
        : value;
    case 'computation':
      return col.typeOptions?.resultType === 'collaborator'
        ? collaborator(value, ctx)
        : displayText(value, col);
    case 'multipleAttachment':
      return Array.isArray(value)
        ? value.map((a) => ({
            ...a,
            url: ctx.signedUrls[a.url] ?? a.url,
          }))
        : value;
    case 'richText':
      return typeof value === 'string' ? value : richTextToMarkdown(value);
    case 'date':
      // date-only cells are midnight UTC; the API sends just the date
      return !col.typeOptions?.isDateTime && typeof value === 'string'
        ? value.slice(0, 10)
        : value;
    case 'button':
      return undefined;
    case 'foreignKey':
    case 'lookup':
    case 'rollup':
    case 'count':
    case 'formula':
      return computedValue(col, value);
    default:
      if (!KNOWN_TYPES.has(col.type)) return displayText(value, col);
      return value;
  }
}

function computedValue(col: any, value: any) {
  const normalized = normalizeColumn(col).column;
  switch (normalized.type) {
    case 'number':
      return typeof value === 'number' ? value : null;
    case 'checkbox':
      return !!value;
    case 'date':
      if (typeof value !== 'string') return null;
      return normalized.typeOptions?.isDateTime ? value : value.slice(0, 10);
    default:
      return displayText(value, col) || null;
  }
}

// A cell of any shape as the text Airtable displays.
export function displayText(value: any, col?: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    return col?.typeOptions?.choices?.[value]?.name ?? value;
  }
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (Array.isArray(value))
    return value
      .map((v) => displayText(v, col))
      .filter((v) => v !== '')
      .join(DISPLAY_SEPARATOR);
  if (typeof value === 'object') {
    if (value.valuesByForeignRowId) {
      const order: string[] =
        value.foreignRowIdOrder ?? Object.keys(value.valuesByForeignRowId);
      return displayText(
        order.map((id) => value.valuesByForeignRowId[id]),
        col,
      );
    }
    if ('foreignRowDisplayName' in value)
      return value.foreignRowDisplayName ?? value.foreignRowId ?? '';
    if (value.documentValue) return richTextToMarkdown(value);
    if (typeof value.filename === 'string') return value.filename;
    for (const key of ['name', 'text', 'value', 'label']) {
      if (typeof value[key] === 'string') return value[key];
    }
    return '';
  }
  return '';
}

// Airtable stores rich text as a Quill delta; the API returns markdown.
export function richTextToMarkdown(value: any): string {
  const ops: any[] = value?.documentValue ?? [];
  let out = '';
  let line = '';
  let ordered = 0;
  for (const op of ops) {
    if (typeof op.insert !== 'string') continue;
    const attrs = op.attributes ?? {};
    const parts = op.insert.split('\n');
    parts.forEach((part, i) => {
      if (part) line += inlineMarkdown(part, attrs);
      if (i < parts.length - 1) {
        ordered = attrs.list === 'ordered' ? ordered + 1 : 0;
        out += blockMarkdown(line, attrs, ordered) + '\n';
        line = '';
      }
    });
  }
  return (out + line).replace(/\n+$/, '');
}

function inlineMarkdown(text: string, attrs: any) {
  let t = text;
  if (attrs.code) t = `\`${t}\``;
  if (attrs.bold) t = `**${t}**`;
  if (attrs.italic) t = `_${t}_`;
  if (attrs.strike) t = `~~${t}~~`;
  if (attrs.link) t = `[${t}](${attrs.link})`;
  return t;
}

function blockMarkdown(line: string, attrs: any, ordered: number) {
  if (attrs.header) return `${'#'.repeat(attrs.header)} ${line}`;
  if (attrs.list === 'bullet') return `- ${line}`;
  if (attrs.list === 'ordered') return `${ordered}. ${line}`;
  if (attrs.list === 'checked') return `- [x] ${line}`;
  if (attrs.list === 'unchecked') return `- [ ] ${line}`;
  if (attrs.blockquote) return `> ${line}`;
  return line;
}
