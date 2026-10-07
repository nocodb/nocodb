import { ButtonActionsType, ColumnHelper, FormulaDataTypes, LongTextAiMetaProp, RelationTypes, UITypes } from 'nocodb-sdk'
import type { ColumnType, SourceType, TableType } from 'nocodb-sdk'
import type { Row } from '~/lib/types'

export const CELLS_BASE_ID = 'pPgCellsBase'
export const CELLS_SOURCE_ID = 'bPgCellsSrc'
export const CELLS_TABLE_ID = 'mPgCellsMain'
export const COMPANY_TABLE_ID = 'mPgCellsCompany'

export const cellsUsers = [
  { id: 'usPgAda', email: 'ada@example.com', display_name: 'Ada Lovelace', roles: 'owner' },
  { id: 'usPgGrace', email: 'grace@example.com', display_name: 'Grace Hopper', roles: 'editor' },
  { id: 'usPgAlan', email: 'alan@example.com', display_name: 'Alan Turing', roles: 'viewer' },
]

const userValue = (...ids: string[]) =>
  cellsUsers.filter((u) => ids.includes(u.id)).map(({ id, email, display_name }) => ({ id, email, display_name }))

/** Inline SVG so attachments render without network access. */
const svgThumb = (bg: string, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="100%" height="100%" fill="${bg}"/><text x="50%" y="54%" font-family="Inter,sans-serif" font-size="28" fill="#fff" text-anchor="middle">${label}</text></svg>`,
  )}`

let order = 1

const col = (
  id: string,
  uidt: UITypes,
  title: string,
  {
    colOptions,
    meta,
    ...extra
  }: Omit<Partial<ColumnType>, 'colOptions' | 'meta'> & {
    // loose on purpose: fixtures carry UI-only colOptions keys (parsed_tree, error) the API types omit
    colOptions?: Record<string, unknown>
    meta?: Record<string, unknown>
  } = {},
  modelId = CELLS_TABLE_ID,
): ColumnType => ({
  id,
  uidt,
  title,
  column_name: title.toLowerCase().replace(/\W+/g, '_'),
  fk_model_id: modelId,
  base_id: CELLS_BASE_ID,
  source_id: CELLS_SOURCE_ID,
  order: order++,
  system: false,
  ...extra,
  colOptions: colOptions as ColumnType['colOptions'],
  meta: { ...ColumnHelper.getColumnDefaultMeta(uidt), ...(meta ?? {}) },
})

const selectOptions = [
  { id: 'so1', title: 'Todo', color: '#cfdffe', order: 1 },
  { id: 'so2', title: 'In progress', color: '#fee2d5', order: 2 },
  { id: 'so3', title: 'In review', color: '#ede2fe', order: 3 },
  { id: 'so4', title: 'Done', color: '#d1f7c4', order: 4 },
  { id: 'so5', title: 'Blocked', color: '#ffdce5', order: 5 },
]

const tagOptions = [
  { id: 'mo1', title: 'Design', color: '#cfdffe', order: 1 },
  { id: 'mo2', title: 'Frontend', color: '#d0f1fd', order: 2 },
  { id: 'mo3', title: 'Backend', color: '#c2f5e9', order: 3 },
  { id: 'mo4', title: 'Docs', color: '#ffeab6', order: 4 },
  { id: 'mo5', title: 'Urgent', color: '#ffdaf6', order: 5 },
]

export const companyColumns: ColumnType[] = [
  col('cc_id', UITypes.ID, 'Id', { pk: true, ai: true, dt: 'int4' }, COMPANY_TABLE_ID),
  col('cc_name', UITypes.SingleLineText, 'Name', { pv: true, dt: 'text' }, COMPANY_TABLE_ID),
  col('cc_employees', UITypes.Number, 'Employees', { dt: 'bigint' }, COMPANY_TABLE_ID),
  col('cc_fk', UITypes.ForeignKey, 'main_id', { dt: 'int4', system: true }, COMPANY_TABLE_ID),
]

export interface CellFixture {
  column: ColumnType
  value: unknown
  /** shown under the field name */
  note?: string
  /** editing needs a backend (link pickers, webhooks, AI) — the edit columns still render, but interactions may fail */
  displayOnly?: boolean
}

export interface CellGroup {
  id: string
  title: string
  description: string
  fixtures: CellFixture[]
}

const pk = col('c_id', UITypes.ID, 'Id', { pk: true, ai: true, dt: 'int4' })

const hmLinks = col('c_links_hm', UITypes.Links, 'Companies (Links)', {
  colOptions: {
    type: RelationTypes.HAS_MANY,
    fk_related_model_id: COMPANY_TABLE_ID,
    fk_child_column_id: 'cc_fk',
    fk_parent_column_id: 'c_id',
  },
  meta: { singular: 'Company', plural: 'Companies' },
})

const mmLtar = col('c_ltar_mm', UITypes.LinkToAnotherRecord, 'Partners (Many-to-many)', {
  colOptions: { type: RelationTypes.MANY_TO_MANY, fk_related_model_id: COMPANY_TABLE_ID },
})

const btLtar = col('c_ltar_bt', UITypes.LinkToAnotherRecord, 'Employer (Belongs-to)', {
  colOptions: { type: RelationTypes.BELONGS_TO, fk_related_model_id: COMPANY_TABLE_ID, fk_child_column_id: 'c_fk' },
})

const url = col('c_url', UITypes.URL, 'URL', { dt: 'text' })

const sku = col('c_sku', UITypes.SingleLineText, 'SKU', { dt: 'text' })

export const cellGroups: CellGroup[] = [
  {
    id: 'text',
    title: 'Text',
    description: 'Free-text fields and their typed variants.',
    fixtures: [
      {
        column: col('c_title', UITypes.SingleLineText, 'Title', { pv: true, dt: 'text' }),
        value: 'Redesign the onboarding flow',
        note: 'Display value (primary) column',
      },
      {
        column: col('c_slt', UITypes.SingleLineText, 'Single line text', { dt: 'text' }),
        value: 'Quarterly roadmap review',
      },
      { column: sku, value: 'NC-2048' },
      {
        column: col('c_long', UITypes.LongText, 'Long text', { dt: 'text' }),
        value:
          'Users drop off on the third step. Proposal: merge steps two and three, add inline validation, and show progress at the top of the panel.',
      },
      {
        column: col('c_rich', UITypes.LongText, 'Rich text', { dt: 'text', meta: { richMode: true } }),
        value: '**Goals**\n\n- Faster first value\n- Fewer support tickets\n\n> Ship behind a beta flag first.',
      },
      {
        column: col('c_ai', UITypes.LongText, 'AI text', { dt: 'text', meta: { [LongTextAiMetaProp]: true } }),
        value: { value: 'Summary: onboarding friction is concentrated in step three.', isStale: false },
        note: 'Generate needs an AI integration',
        displayOnly: true,
      },
      { column: col('c_email', UITypes.Email, 'Email', { dt: 'text' }), value: 'ada@example.com' },
      { column: col('c_phone', UITypes.PhoneNumber, 'Phone number', { dt: 'text' }), value: '+1 415 555 0132' },
      { column: url, value: 'https://nocodb.com' },
      {
        column: col('c_specific', UITypes.SpecificDBType, 'Specific DB type', { dt: 'inet' }),
        value: '192.168.0.1',
        note: 'Renders as plain text',
      },
    ],
  },
  {
    id: 'numbers',
    title: 'Numbers',
    description: 'Numeric fields with their formatting meta.',
    fixtures: [
      { column: col('c_number', UITypes.Number, 'Number', { dt: 'bigint' }), value: 1284 },
      { column: col('c_decimal', UITypes.Decimal, 'Decimal', { dt: 'decimal', meta: { precision: 2 } }), value: 3.14159 },
      {
        column: col('c_currency', UITypes.Currency, 'Currency', { dt: 'decimal' }),
        value: 129900.5,
      },
      {
        column: col('c_currency_eur', UITypes.Currency, 'Currency (EUR, de-DE)', {
          dt: 'decimal',
          meta: { currency_locale: 'de-DE', currency_code: 'EUR' },
        }),
        value: 4820.75,
      },
      { column: col('c_percent', UITypes.Percent, 'Percent', { dt: 'decimal' }), value: 64 },
      {
        column: col('c_progress', UITypes.Percent, 'Percent (progress bar)', { dt: 'decimal', meta: { is_progress: true } }),
        value: 72,
      },
      { column: col('c_duration', UITypes.Duration, 'Duration', { dt: 'decimal', meta: { duration: 0 } }), value: 5430 },
      { column: col('c_rating', UITypes.Rating, 'Rating', { dt: 'smallint' }), value: 4 },
      {
        column: col('c_rating_heart', UITypes.Rating, 'Rating (hearts, max 10)', {
          dt: 'smallint',
          meta: { icon: { full: 'mdi-heart', empty: 'mdi-heart-outline' }, color: '#f43f5e', max: 10 },
        }),
        value: 7,
      },
      { column: col('c_year', UITypes.Year, 'Year', { dt: 'int' }), value: 2026 },
      { column: col('c_autonumber', UITypes.AutoNumber, 'Auto number', { dt: 'int' }), value: 1042, note: 'Always read-only' },
    ],
  },
  {
    id: 'choices',
    title: 'Choices, toggles & people',
    description: 'Select options, checkboxes, colours and collaborators.',
    fixtures: [
      { column: col('c_checkbox', UITypes.Checkbox, 'Checkbox', { dt: 'bool' }), value: true },
      {
        column: col('c_checkbox_star', UITypes.Checkbox, 'Checkbox (star)', {
          dt: 'bool',
          meta: { icon: { checked: 'mdi-star', unchecked: 'mdi-star-outline' }, color: '#fcb401' },
        }),
        value: false,
      },
      {
        column: col('c_single', UITypes.SingleSelect, 'Single select', {
          dt: 'text',
          colOptions: { options: selectOptions },
        }),
        value: 'In progress',
      },
      {
        column: col('c_multi', UITypes.MultiSelect, 'Multi select', { dt: 'text', colOptions: { options: tagOptions } }),
        value: 'Design,Frontend,Urgent',
      },
      { column: col('c_colour', UITypes.Colour, 'Colour', { dt: 'text' }), value: '#3366FF' },
      { column: col('c_user', UITypes.User, 'User', { dt: 'text' }), value: userValue('usPgAda') },
      {
        column: col('c_users', UITypes.User, 'User (multiple)', { dt: 'text', meta: { is_multi: true } }),
        value: userValue('usPgAda', 'usPgGrace', 'usPgAlan'),
      },
    ],
  },
  {
    id: 'dates',
    title: 'Dates & times',
    description: 'Pickers open from the editing states.',
    fixtures: [
      { column: col('c_date', UITypes.Date, 'Date', { dt: 'date' }), value: '2026-10-03' },
      {
        column: col('c_date_fmt', UITypes.Date, 'Date (DD MMM YYYY)', { dt: 'date', meta: { date_format: 'DD MMM YYYY' } }),
        value: '2026-12-24',
      },
      { column: col('c_datetime', UITypes.DateTime, 'Date time', { dt: 'timestamp' }), value: '2026-10-03 14:30:00+00:00' },
      {
        column: col('c_datetime_12', UITypes.DateTime, 'Date time (12h)', { dt: 'timestamp', meta: { is12hrFormat: true } }),
        value: '2026-10-03 09:15:00+00:00',
      },
      { column: col('c_time', UITypes.Time, 'Time', { dt: 'time' }), value: '18:45:00' },
    ],
  },
  {
    id: 'media',
    title: 'Files, JSON & location',
    description: 'Structured values.',
    fixtures: [
      {
        column: col('c_attachment', UITypes.Attachment, 'Attachment', { dt: 'text' }),
        value: [
          { title: 'cover.svg', mimetype: 'image/svg+xml', size: 2048, url: svgThumb('#3366ff', 'Cover') },
          { title: 'moodboard.svg', mimetype: 'image/svg+xml', size: 4096, url: svgThumb('#7c3aed', 'Mood') },
          {
            title: 'brief.pdf',
            mimetype: 'application/pdf',
            size: 120400,
            url: 'data:application/pdf;base64,JVBERi0xLjQKJSVFT0YK',
          },
        ],
        note: 'Upload needs a backend',
      },
      {
        column: col('c_json', UITypes.JSON, 'JSON', { dt: 'json' }),
        value: JSON.stringify({ plan: 'business', seats: 25, features: ['sso', 'audit'] }),
      },
      { column: col('c_geo', UITypes.GeoData, 'Geo data', { dt: 'text' }), value: '12.9716;77.5946' },
      {
        column: col('c_uuid', UITypes.UUID, 'UUID', { dt: 'uuid' }),
        value: '7f3c2b9e-4d1a-4c8e-9b2f-1a6e5d4c3b2a',
        note: 'Always read-only',
      },
    ],
  },
  {
    id: 'computed',
    title: 'Computed',
    description: 'Values computed by the backend; shown from row data.',
    fixtures: [
      {
        column: col('c_formula_text', UITypes.Formula, 'Formula (text)', {
          colOptions: {
            formula: 'CONCAT({Title}, " · ", {Single select})',
            formula_raw: 'CONCAT({Title}, " · ", {Single select})',
            parsed_tree: { dataType: FormulaDataTypes.STRING },
          },
        }),
        value: 'Redesign the onboarding flow · In progress',
      },
      {
        column: col('c_formula_num', UITypes.Formula, 'Formula (number)', {
          colOptions: {
            formula: '{Number} * 2',
            formula_raw: '{Number} * 2',
            parsed_tree: { dataType: FormulaDataTypes.NUMERIC },
          },
        }),
        value: 2568,
      },
      {
        column: col('c_formula_err', UITypes.Formula, 'Formula (error)', {
          colOptions: { formula: '{Missing}', formula_raw: '{Missing}', error: 'Field Missing not found' },
        }),
        value: null,
      },
      {
        column: col('c_rollup', UITypes.Rollup, 'Rollup (sum of employees)', {
          colOptions: { fk_relation_column_id: 'c_links_hm', fk_rollup_column_id: 'cc_employees', rollup_function: 'sum' },
        }),
        value: 1240,
      },
      {
        column: col('c_lookup', UITypes.Lookup, 'Lookup (company names)', {
          colOptions: { fk_relation_column_id: 'c_links_hm', fk_lookup_column_id: 'cc_name' },
        }),
        value: ['Acme', 'Globex', 'Initech'],
      },
      {
        column: col('c_qr', UITypes.QrCode, 'QR code', { colOptions: { fk_qr_value_column_id: 'c_url' } }),
        value: 'https://nocodb.com',
      },
      {
        column: col('c_barcode', UITypes.Barcode, 'Barcode', {
          colOptions: { fk_barcode_value_column_id: 'c_sku', barcode_format: 'CODE128' },
        }),
        value: 'NC-2048',
      },
    ],
  },
  {
    id: 'buttons',
    title: 'Buttons',
    description: 'Button field themes and colours. URL buttons open the link; webhook / AI / script need a backend.',
    fixtures: [
      ...(['solid', 'light', 'text'] as const).map((theme) => ({
        column: col(`c_btn_url_${theme}`, UITypes.Button, `Button · URL (${theme})`, {
          colOptions: { type: ButtonActionsType.Url, label: 'Open site', theme, color: 'brand', icon: 'ncExternalLink' },
        }),
        value: { url: 'https://nocodb.com' },
      })),
      ...(['green', 'red', 'orange', 'purple', 'gray'] as const).map((color) => ({
        column: col(`c_btn_${color}`, UITypes.Button, `Button · ${color}`, {
          colOptions: { type: ButtonActionsType.Url, label: 'Approve', theme: 'light', color, icon: 'ncCheck' },
        }),
        value: { url: 'https://nocodb.com' },
      })),
      {
        column: col('c_btn_webhook', UITypes.Button, 'Button · Webhook', {
          colOptions: {
            type: ButtonActionsType.Webhook,
            label: 'Notify team',
            theme: 'solid',
            color: 'green',
            fk_webhook_id: 'hkPg',
          },
        }),
        value: { fk_webhook_id: 'hkPg' },
        displayOnly: true,
      },
      {
        column: col('c_btn_ai', UITypes.Button, 'Button · AI', {
          colOptions: { type: ButtonActionsType.Ai, label: 'Generate', theme: 'light', color: 'purple', icon: 'cellAi' },
        }),
        value: null,
        note: 'Disabled without an AI integration',
        displayOnly: true,
      },
    ],
  },
  {
    id: 'relations',
    title: 'Relations',
    description: 'Link fields. Opening the record picker queries the backend, so interact with these read-only.',
    fixtures: [
      { column: hmLinks, value: 3, displayOnly: true },
      {
        column: mmLtar,
        value: [
          { Id: 1, Name: 'Acme' },
          { Id: 2, Name: 'Globex' },
        ],
        displayOnly: true,
      },
      { column: btLtar, value: { Id: 3, Name: 'Initech' }, displayOnly: true },
    ],
  },
  {
    id: 'system',
    title: 'System',
    description: 'Audit and key fields maintained by NocoDB.',
    fixtures: [
      { column: pk, value: 42, note: 'Primary key' },
      {
        column: col('c_created_time', UITypes.CreatedTime, 'Created time', { dt: 'timestamp' }),
        value: '2026-09-01 08:00:00+00:00',
      },
      {
        column: col('c_modified_time', UITypes.LastModifiedTime, 'Last modified time', { dt: 'timestamp' }),
        value: '2026-10-02 17:42:00+00:00',
      },
      { column: col('c_created_by', UITypes.CreatedBy, 'Created by', { dt: 'text' }), value: userValue('usPgGrace') },
      {
        column: col('c_modified_by', UITypes.LastModifiedBy, 'Last modified by', { dt: 'text' }),
        value: userValue('usPgAlan'),
      },
    ],
  },
]

const fkColumn = col('c_fk', UITypes.ForeignKey, 'company_id', { dt: 'int4', system: true })

export const cellsTableMeta = (): TableType => {
  const columns = [...cellGroups.flatMap((g) => g.fixtures.map((f) => f.column)), fkColumn]
  return {
    id: CELLS_TABLE_ID,
    title: 'Cells',
    table_name: 'cells',
    base_id: CELLS_BASE_ID,
    source_id: CELLS_SOURCE_ID,
    columns,
    columnsById: Object.fromEntries(columns.map((c) => [c.id, c])),
  } as TableType
}

export const companyTableMeta = (): TableType =>
  ({
    id: COMPANY_TABLE_ID,
    title: 'Companies',
    table_name: 'companies',
    base_id: CELLS_BASE_ID,
    source_id: CELLS_SOURCE_ID,
    columns: companyColumns,
    columnsById: Object.fromEntries(companyColumns.map((c) => [c.id, c])),
  } as TableType)

export const createCellsRow = (): Row => ({
  row: Object.fromEntries(cellGroups.flatMap((g) => g.fixtures.map((f) => [f.column.title!, structuredClone(f.value)]))),
  oldRow: {},
  rowMeta: {},
})

export const cellsSource: SourceType = {
  id: CELLS_SOURCE_ID,
  base_id: CELLS_BASE_ID,
  type: 'pg',
  enabled: true,
  is_meta: false,
}

export const cellsBase = {
  id: CELLS_BASE_ID,
  title: 'Playground cells',
  sources: [cellsSource],
}
