import { UITypes, ViewTypes } from 'nocodb-sdk'
import type { ColumnType, TableType, ViewType } from 'nocodb-sdk'

/**
 * The view pages use the route `/playground/:baseId(views)/:viewId`, so the
 * base id is literally `views` and each view type gets its own mock table whose
 * id is the URL slug (`grid`, `gallery`, ...). Stores that resolve the active
 * table/view from route params then work unmodified.
 */
export const MOCK_BASE_ID = 'views'
export const MOCK_WORKSPACE_ID = 'pgws'
export const MOCK_SOURCE_ID = 'pgsrc'
export const MOCK_TASKS_TABLE_ID = 'pg-tasks'

export const MOCK_VIEW_KINDS = ['grid', 'gallery', 'kanban', 'calendar', 'form', 'map', 'list', 'timeline', 'gantt'] as const
export type MockViewKind = (typeof MOCK_VIEW_KINDS)[number]

/** Record the `/playground/views/expanded` alias opens. */
export const EXPANDED_DEMO_ROW_ID = 3

export const isMockViewKind = (v: unknown): v is MockViewKind => MOCK_VIEW_KINDS.includes(v as MockViewKind)

export const MOCK_USERS = [
  { id: 'pgu1', email: 'ava.chen@acme.dev', display_name: 'Ava Chen' },
  { id: 'pgu2', email: 'liam.patel@acme.dev', display_name: 'Liam Patel' },
  { id: 'pgu3', email: 'sofia.garcia@acme.dev', display_name: 'Sofia Garcia' },
  { id: 'pgu4', email: 'noah.kim@acme.dev', display_name: 'Noah Kim' },
  { id: 'pgu5', email: 'mia.okafor@acme.dev', display_name: 'Mia Okafor' },
]

const STATUS = [
  { title: 'Idea', color: '#cfdffe' },
  { title: 'Planned', color: '#d0f1fd' },
  { title: 'In progress', color: '#fee2d5' },
  { title: 'Shipped', color: '#d1f7c4' },
  { title: 'Blocked', color: '#ffdce5' },
]

const TAGS = [
  { title: 'Web', color: '#cfdffe' },
  { title: 'Mobile', color: '#ede2fe' },
  { title: 'API', color: '#c2f5e9' },
  { title: 'AI', color: '#ffdaf6' },
  { title: 'Design', color: '#ffeab6' },
  { title: 'Infra', color: '#eeeeee' },
]

export const COL = {
  id: 'pgc-id',
  title: 'pgc-title',
  notes: 'pgc-notes',
  status: 'pgc-status',
  tags: 'pgc-tags',
  owner: 'pgc-owner',
  launch: 'pgc-launch',
  kickoff: 'pgc-kickoff',
  budget: 'pgc-budget',
  progress: 'pgc-progress',
  priority: 'pgc-priority',
  effort: 'pgc-effort',
  approved: 'pgc-approved',
  contact: 'pgc-contact',
  website: 'pgc-website',
  phone: 'pgc-phone',
  cover: 'pgc-cover',
  tasks: 'pgc-tasks',
  start: 'pgc-start',
  end: 'pgc-end',
  location: 'pgc-location',
  nextSteps: 'pgc-next-steps',
  parentFk: 'pgc-parent-fk',
  order: 'pgc-order',
  createdAt: 'pgc-created-at',
  updatedAt: 'pgc-updated-at',
} as const

const selectOptions = (colId: string, opts: Array<{ title: string; color: string }>) => ({
  options: opts.map((o, i) => ({ id: `${colId}-opt-${i}`, fk_column_id: colId, title: o.title, color: o.color, order: i + 1 })),
})

export function buildColumns(tableId: string): ColumnType[] {
  let order = 1
  const col = (c: Partial<ColumnType> & { id: string; title: string; uidt: UITypes }): ColumnType => ({
    column_name: c.title.toLowerCase().replace(/\W+/g, '_'),
    fk_model_id: tableId,
    base_id: MOCK_BASE_ID,
    source_id: MOCK_SOURCE_ID,
    fk_workspace_id: MOCK_WORKSPACE_ID,
    order: order++,
    system: false,
    meta: {},
    ...c,
  })
  return [
    col({ id: COL.id, title: 'Id', uidt: UITypes.ID, dt: 'int4', pk: true, ai: true, system: false }),
    col({ id: COL.title, title: 'Launch', uidt: UITypes.SingleLineText, dt: 'text', pv: true }),
    col({
      id: COL.status,
      title: 'Status',
      uidt: UITypes.SingleSelect,
      dt: 'text',
      colOptions: selectOptions(COL.status, STATUS),
    }),
    col({ id: COL.owner, title: 'Owner', uidt: UITypes.User, dt: 'varchar', meta: { is_multi: false, notify: false } }),
    col({ id: COL.tags, title: 'Tags', uidt: UITypes.MultiSelect, dt: 'text', colOptions: selectOptions(COL.tags, TAGS) }),
    col({ id: COL.launch, title: 'Launch date', uidt: UITypes.Date, dt: 'date', meta: { date_format: 'YYYY-MM-DD' } }),
    col({
      id: COL.kickoff,
      title: 'Kickoff',
      uidt: UITypes.DateTime,
      dt: 'timestamp',
      meta: { date_format: 'YYYY-MM-DD', time_format: 'HH:mm', is12hrFormat: false },
    }),
    col({ id: COL.cover, title: 'Cover', uidt: UITypes.Attachment, dt: 'text' }),
    col({
      id: COL.budget,
      title: 'Budget',
      uidt: UITypes.Currency,
      dt: 'decimal',
      meta: { currency_locale: 'en-US', currency_code: 'USD' },
    }),
    col({ id: COL.progress, title: 'Progress', uidt: UITypes.Percent, dt: 'decimal', meta: { is_progress: true } }),
    col({
      id: COL.priority,
      title: 'Priority',
      uidt: UITypes.Rating,
      dt: 'int',
      meta: { iconIdx: 0, icon: { full: 'mdi-star', empty: 'mdi-star-outline' }, color: '#fcb401', max: 5 },
    }),
    col({ id: COL.effort, title: 'Effort (pts)', uidt: UITypes.Number, dt: 'bigint' }),
    col({ id: COL.approved, title: 'Approved', uidt: UITypes.Checkbox, dt: 'bool', meta: { color: '#36BFFF', iconIdx: 0 } }),
    col({ id: COL.notes, title: 'Notes', uidt: UITypes.LongText, dt: 'text' }),
    col({ id: COL.contact, title: 'Contact', uidt: UITypes.Email, dt: 'varchar' }),
    col({ id: COL.website, title: 'Website', uidt: UITypes.URL, dt: 'varchar' }),
    col({ id: COL.phone, title: 'Phone', uidt: UITypes.PhoneNumber, dt: 'varchar' }),
    col({
      id: COL.tasks,
      title: 'Tasks',
      uidt: UITypes.Links,
      meta: { singular: 'Task', plural: 'Tasks' },
      colOptions: {
        type: 'hm',
        fk_related_model_id: MOCK_TASKS_TABLE_ID,
        fk_child_column_id: 'pgt-fk',
        fk_parent_column_id: COL.id,
      } as ColumnType['colOptions'],
    }),
    col({ id: COL.start, title: 'Start date', uidt: UITypes.Date, dt: 'date', meta: { date_format: 'YYYY-MM-DD' } }),
    col({ id: COL.end, title: 'End date', uidt: UITypes.Date, dt: 'date', meta: { date_format: 'YYYY-MM-DD' } }),
    col({ id: COL.location, title: 'Location', uidt: UITypes.GeoData, dt: 'text' }),
    // gantt only: self has-many link driving the dependency arrows
    ...(tableId === 'gantt'
      ? [
          col({
            id: COL.nextSteps,
            title: 'Next steps',
            uidt: UITypes.Links,
            meta: { singular: 'Next step', plural: 'Next steps' },
            colOptions: {
              type: 'hm',
              fk_related_model_id: tableId,
              fk_child_column_id: COL.parentFk,
              fk_parent_column_id: COL.id,
            } as ColumnType['colOptions'],
          }),
          col({ id: COL.parentFk, title: 'parent_id', uidt: UITypes.ForeignKey, dt: 'int4', system: true }),
        ]
      : []),
    // real tables carry nc_order; it enables insert above/below, duplicate and row drag
    col({ id: COL.order, title: 'nc_order', uidt: UITypes.Order, dt: 'decimal', system: true }),
    col({ id: COL.createdAt, title: 'CreatedAt', uidt: UITypes.CreatedTime, dt: 'timestamp', system: true }),
    col({ id: COL.updatedAt, title: 'UpdatedAt', uidt: UITypes.LastModifiedTime, dt: 'timestamp', system: true }),
  ]
}

export function mockBase() {
  return {
    id: MOCK_BASE_ID,
    title: 'Playground',
    fk_workspace_id: MOCK_WORKSPACE_ID,
    type: 'database',
    meta: {},
    isLoaded: true,
    sources: [{ id: MOCK_SOURCE_ID, base_id: MOCK_BASE_ID, type: 'pg', is_meta: true, is_local: true, enabled: true, order: 1 }],
  }
}

const VIEW_TYPE: Record<MockViewKind, ViewTypes> = {
  grid: ViewTypes.GRID,
  gallery: ViewTypes.GALLERY,
  kanban: ViewTypes.KANBAN,
  calendar: ViewTypes.CALENDAR,
  form: ViewTypes.FORM,
  map: ViewTypes.MAP,
  list: ViewTypes.LIST,
  timeline: ViewTypes.TIMELINE,
  gantt: ViewTypes.GANTT,
}

export function buildTable(kind: MockViewKind): TableType {
  const columns = buildColumns(kind)
  return {
    id: kind,
    title: 'Product launches',
    table_name: 'product_launches',
    type: 'table',
    base_id: MOCK_BASE_ID,
    source_id: MOCK_SOURCE_ID,
    fk_workspace_id: MOCK_WORKSPACE_ID,
    enabled: true,
    meta: {},
    columns,
    // the server sends this alongside columns; kanban/gallery cover lookups need it
    columnsById: Object.fromEntries(columns.map((c) => [c.id!, c])),
    views: [buildView(kind)],
  } as TableType
}

export function buildTasksTable(): TableType {
  return {
    id: MOCK_TASKS_TABLE_ID,
    title: 'Tasks',
    table_name: 'tasks',
    type: 'table',
    base_id: MOCK_BASE_ID,
    source_id: MOCK_SOURCE_ID,
    fk_workspace_id: MOCK_WORKSPACE_ID,
    meta: {},
    columns: [
      {
        id: 'pgt-id',
        title: 'Id',
        uidt: UITypes.ID,
        pk: true,
        fk_model_id: MOCK_TASKS_TABLE_ID,
        base_id: MOCK_BASE_ID,
        system: false,
      },
      {
        id: 'pgt-title',
        title: 'Task',
        uidt: UITypes.SingleLineText,
        pv: true,
        fk_model_id: MOCK_TASKS_TABLE_ID,
        base_id: MOCK_BASE_ID,
        system: false,
      },
      {
        id: 'pgt-fk',
        title: 'launch_id',
        uidt: UITypes.ForeignKey,
        fk_model_id: MOCK_TASKS_TABLE_ID,
        base_id: MOCK_BASE_ID,
        system: true,
      },
    ],
  } as TableType
}

export function buildView(kind: MockViewKind): ViewType {
  const id = `vw-pg-${kind}`
  const common = {
    id,
    title: `${kind[0].toUpperCase()}${kind.slice(1)} view`,
    type: VIEW_TYPE[kind],
    fk_model_id: kind,
    base_id: MOCK_BASE_ID,
    source_id: MOCK_SOURCE_ID,
    fk_workspace_id: MOCK_WORKSPACE_ID,
    lock_type: 'collaborative' as const,
    show: true,
    order: 1,
    meta: {},
    is_default: kind === 'grid',
  }

  const typeMeta: Record<MockViewKind, Record<string, any>> = {
    grid: { fk_view_id: id, row_height: 0, meta: null },
    gallery: { fk_view_id: id, fk_cover_image_col_id: COL.cover, meta: {} },
    kanban: {
      fk_view_id: id,
      fk_grp_col_id: COL.status,
      fk_cover_image_col_id: COL.cover,
      meta: {
        [COL.status]: [
          { id: 'uncategorized', title: null, order: 0, color: '#c2f5e8', collapsed: false },
          ...STATUS.map((s, i) => ({
            id: `${COL.status}-opt-${i}`,
            fk_column_id: COL.status,
            title: s.title,
            color: s.color,
            order: i + 1,
            collapsed: false,
          })),
        ],
      },
    },
    calendar: {
      fk_view_id: id,
      calendar_range: [{ fk_from_column_id: COL.launch, id: 'pg-cal-range' }],
      meta: {},
    },
    form: {
      fk_view_id: id,
      heading: 'Pitch a product launch',
      subheading: 'Tell the launch committee what you want to ship and when.',
      success_msg: 'Thanks! The committee reviews new pitches every Monday.',
      submit_another_form: true,
      show_blank_form: false,
      banner_image_url: null,
      logo_url: null,
      meta: { theme: 'default' },
    },
    map: { fk_view_id: id, fk_geo_data_col_id: COL.location, meta: {} },
    // one level = a flat list of this table's records
    list: {
      fk_view_id: id,
      show_empty_parents: true,
      levels: [{ id: 'pg-list-level-1', fk_view_id: id, level: 1, fk_model_id: kind, meta: {} }],
      meta: {},
    },
    timeline: {
      fk_view_id: id,
      timeline_range: [{ id: 'pg-timeline-range', fk_from_column_id: COL.start, fk_to_column_id: COL.end }],
      meta: {},
    },
    gantt: {
      fk_view_id: id,
      date_dependency: {
        id: 'pg-gantt-dep',
        fk_model_id: kind,
        fk_start_date_field_id: COL.start,
        fk_end_date_field_id: COL.end,
        fk_dependency_linkrow_field_id: COL.nextSteps,
        dependency_linkrow_role: 'successors',
        dependency_connection_type: 'end-to-start',
        dependency_buffer_type: 'flexible',
        dependency_buffer_days: 0,
        include_weekends: true,
        is_active: true,
      },
      meta: {},
    },
  }

  return { ...common, view: typeMeta[kind] }
}

// deterministic pseudo-random so every reload shows the same board
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const PALETTE = [
  ['#3366ff', '#8fa8ff'],
  ['#7c3aed', '#c4b5fd'],
  ['#0d9488', '#99f6e4'],
  ['#ea580c', '#fdba74'],
  ['#e11d48', '#fda4af'],
  ['#0891b2', '#a5f3fc'],
  ['#65a30d', '#d9f99d'],
  ['#9333ea', '#f0abfc'],
]

const coverCache = new Map<number, string>()

/** PNG, not SVG: the file previewer refuses SVG attachments. */
function coverImage(i: number, label: string) {
  const cached = coverCache.get(i)
  if (cached) return cached
  const [a, b] = PALETTE[i % PALETTE.length]
  const canvas = document.createElement('canvas')
  canvas.width = 480
  canvas.height = 300
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const gradient = ctx.createLinearGradient(0, 0, 480, 300)
  gradient.addColorStop(0, a)
  gradient.addColorStop(1, b)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 480, 300)
  ctx.beginPath()
  ctx.arc(120 + ((i * 53) % 260), 90 + ((i * 37) % 140), 60 + ((i * 11) % 50), 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
  ctx.fill()
  ctx.font = '700 30px Inter, Arial, sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(label, 32, 262)
  const url = canvas.toDataURL('image/png')
  coverCache.set(i, url)
  return url
}

const NAMES = [
  'Realtime cursors',
  'Dark mode 2.0',
  'Offline sync',
  'AI field suggestions',
  'Bulk import wizard',
  'Audit log export',
  'SAML SSO',
  'Mobile record view',
  'Calendar drag-resize',
  'Formula autocomplete',
  'Webhook retries',
  'Public form themes',
  'Kanban swimlanes',
  'Gantt dependencies',
  'Interface templates',
  'Row-level security',
  'Scripting sandbox',
  'Usage dashboard',
  'Slack notifications',
  'Undo history panel',
  'Field-level comments',
  'Granular API tokens',
  'Map view clustering',
  'CSV streaming export',
  'Data reflection',
  'Workspace analytics',
  'Smart text fields',
  'Barcode scanning',
  'Timeline zoom',
  'Custom domains',
  'Sandbox merge',
  'Command palette',
  'Attachment previews',
  'Record templates',
  'Multi-base search',
  'Linked record cards',
  'Theme editor',
  'Interface embeds',
  'Activity feed',
  'Shared view analytics',
]

const NOTES = [
  'Needs a design review before we commit to a date.',
  'Customer-requested; three enterprise accounts are waiting on this.',
  'Behind a beta flag first, then a gradual rollout.',
  'Perf budget: under 100ms on a 50k-row table.',
  'Docs and a changelog post go out on launch day.',
  'Blocked on the API contract — see the RFC thread.',
]

const CITIES: Array<[number, number]> = [
  [37.7749, -122.4194],
  [40.7128, -74.006],
  [51.5074, -0.1278],
  [52.52, 13.405],
  [12.9716, 77.5946],
  [35.6762, 139.6503],
  [-33.8688, 151.2093],
  [-23.5505, -46.6333],
]

/** Row index (0-based) of the gantt predecessor, or null — chains of three: i%5 = 0 → 1 → 2. */
export const ganttParentIndex = (i: number) => (i < 20 && i % 5 > 0 && i % 5 < 3 ? i - 1 : null)

const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function cover(i: number, name: string, slug: string) {
  const url = coverImage(i, name)
  // base64 → bytes, close enough for the size label
  return { url, signedUrl: url, title: `${slug}.png`, mimetype: 'image/png', size: Math.round(url.length * 0.75), id: `att-${i}` }
}

export function buildRows(count = 40): Record<string, any>[] {
  const r = rng(42)
  // separate stream so the original columns keep their values
  const r2 = rng(7)
  const ends: Date[] = []
  const pick = <T>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)]
  const base = new Date()
  base.setDate(1)
  const rows: Record<string, any>[] = []
  for (let i = 0; i < count; i++) {
    const name = NAMES[i % NAMES.length]
    const launch = new Date(base)
    launch.setDate(1 + Math.floor(r() * 56) - 7)
    const kickoff = new Date(launch)
    kickoff.setDate(launch.getDate() - 14 - Math.floor(r() * 20))
    kickoff.setHours(9 + Math.floor(r() * 8), r() > 0.5 ? 30 : 0, 0, 0)
    const status = i % 9 === 0 ? null : pick(STATUS).title
    const tagCount = 1 + Math.floor(r() * 3)
    const tags = [...new Set(Array.from({ length: tagCount }, () => pick(TAGS).title))]
    const owner = pick(MOCK_USERS)
    const slug = name.toLowerCase().replace(/\W+/g, '-')
    const parentIdx = ganttParentIndex(i)
    const start = new Date(base)
    if (parentIdx !== null) start.setTime(ends[parentIdx].getTime() + 86400000)
    else start.setDate(1 + Math.floor(r2() * 22))
    const end = new Date(start)
    end.setDate(start.getDate() + 1 + Math.floor(r2() * 7))
    ends.push(end)
    const [lat, lng] = CITIES[i % CITIES.length]
    const location = `${(lat + (r2() - 0.5) * 0.2).toFixed(4)};${(lng + (r2() - 0.5) * 0.2).toFixed(4)}`
    rows.push({
      'Id': i + 1,
      'Launch': name,
      'Status': status,
      'Owner': [{ id: owner.id, email: owner.email, display_name: owner.display_name }],
      'Tags': tags.join(','),
      'Launch date': launch.toISOString().slice(0, 10),
      'Kickoff': kickoff.toISOString(),
      'Cover': i % 5 === 3 ? null : [cover(i, name, slug)],
      'Budget': Math.round(5 + r() * 120) * 1000,
      'Progress': status === 'Shipped' ? 100 : Math.round(r() * 95),
      'Priority': 1 + Math.floor(r() * 5),
      'Effort (pts)': [1, 2, 3, 5, 8, 13][Math.floor(r() * 6)],
      'Approved': r() > 0.45,
      'Notes': pick(NOTES),
      'Contact': owner.email,
      'Website': `https://acme.dev/launch/${slug}`,
      'Phone': `+1 415 555 0${String(100 + i).slice(-3)}`,
      'Tasks': Math.floor(r() * 9),
      'Start date': toDateStr(start),
      'End date': toDateStr(end),
      'Location': location,
      'Next steps': ganttParentIndex(i + 1) === i ? 1 : 0,
      'parent_id': parentIdx === null ? null : parentIdx + 1,
      'nc_order': i + 1,
      'CreatedAt': new Date(kickoff.getTime() - 86400000 * 3).toISOString(),
      'UpdatedAt': new Date(kickoff.getTime() + 86400000).toISOString(),
    })
  }
  return rows
}

const TASK_NAMES = [
  'Write the spec',
  'Design review',
  'API contract',
  'Build a prototype',
  'QA pass',
  'Docs draft',
  'Changelog post',
  'Beta rollout',
  'Perf check',
  'Security review',
]

/** Rows of the linked Tasks table: each launch's `Tasks` count worth, plus a few unassigned. */
export function buildTasks(rows: Record<string, any>[]): Record<string, any>[] {
  const tasks: Record<string, any>[] = []
  const add = (launchId: number | null, name: string) => tasks.push({ Id: tasks.length + 1, Task: name, launch_id: launchId })
  for (const row of rows) {
    for (let j = 0; j < (row.Tasks ?? 0); j++) add(row.Id, TASK_NAMES[(row.Id + j) % TASK_NAMES.length])
  }
  for (let j = 0; j < 6; j++) add(null, `${TASK_NAMES[(j * 3) % TASK_NAMES.length]} (unassigned)`)
  return tasks
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString()

export interface MockComment {
  id: string
  row_id: string
  fk_model_id: string
  comment: string
  created_by: string
  created_by_email: string
  created_at: string
  updated_at: string
  is_edited?: boolean
  parent_comment_id?: string | null
  resolved_by?: string | null
}

const COMMENT_SEED: Array<[rowId: number, userIdx: number, hours: number, text: string]> = [
  [3, 1, 30, 'Pulled the latest usage numbers — 18% of new tables already have a suggested field accepted.'],
  [3, 4, 26, '@Ava Chen can we keep the model picker hidden for the beta? One less decision for users.'],
  [3, 0, 3, 'Agreed. Shipping behind the flag on Monday, docs are in review.'],
  [1, 2, 50, 'Cursor colours clash in dark mode, filed a follow-up.'],
  [7, 3, 12, 'Security review signed off.'],
]

export function buildComments(tableId: string): MockComment[] {
  return COMMENT_SEED.map(([rowId, userIdx, hours, text], i) => ({
    id: `pg-cmt-${i + 1}`,
    row_id: String(rowId),
    fk_model_id: tableId,
    comment: text,
    created_by: MOCK_USERS[userIdx].id,
    created_by_email: MOCK_USERS[userIdx].email,
    created_at: hoursAgo(hours),
    updated_at: hoursAgo(hours),
    is_edited: false,
    parent_comment_id: null,
    resolved_by: null,
  }))
}

/** v3 field shape the audit renderer reads from `details.column_meta`. */
export function auditColumnMeta(columns: ColumnType[], titles: string[]) {
  const meta: Record<string, { id?: string; title?: string; type?: string; options: Record<string, unknown> }> = {}
  for (const title of titles) {
    const c = columns.find((col) => col.title === title)
    if (!c) continue
    const choices = (c.colOptions as { options?: Array<{ title?: string; color?: string }> } | undefined)?.options
    const options: Record<string, unknown> =
      c.uidt === UITypes.SingleSelect || c.uidt === UITypes.MultiSelect
        ? { choices: (choices ?? []).map((o) => ({ title: o.title, color: o.color })) }
        : c.uidt === UITypes.Currency
        ? { locale: 'en-US', code: 'USD' }
        : { ...(c.meta as object) }
    meta[title] = { id: c.id, title: c.title, type: c.uidt, options }
  }
  return meta
}

const EFFORT = [1, 2, 3, 5, 8, 13]

/** Seeded revision history for a record, newest first (the server's order). Built from the seed values, so edits made in the tab append their own entries instead of rewriting these. */
export function buildAudits(tableId: string, seed: Record<string, any>) {
  const columns = buildColumns(tableId)
  const audit = (n: number, userIdx: number, hours: number, op_type: string, details: Record<string, any>) => ({
    id: `pg-audit-${seed.Id}-${n}`,
    row_id: String(seed.Id),
    fk_model_id: tableId,
    op_type,
    version: 1,
    user: MOCK_USERS[userIdx].email,
    fk_user_id: MOCK_USERS[userIdx].id,
    created_at: hoursAgo(hours),
    details: JSON.stringify(details),
  })
  const statusIdx = STATUS.findIndex((s) => s.title === seed.Status)
  const effortIdx = EFFORT.indexOf(seed['Effort (pts)'])
  const oldEffort = EFFORT[effortIdx > 0 ? effortIdx - 1 : 1]
  return [
    // a status that moved past Idea gets a "moved on from Idea" entry
    ...(statusIdx > 0
      ? [
          audit(3, 0, 5, 'DATA_UPDATE', {
            data: { Status: seed.Status },
            old_data: { Status: STATUS[statusIdx - 1].title },
            column_meta: auditColumnMeta(columns, ['Status']),
          }),
        ]
      : []),
    audit(2, 1, 28, 'DATA_UPDATE', {
      data: { 'Budget': seed.Budget, 'Effort (pts)': seed['Effort (pts)'] },
      old_data: { 'Budget': seed.Budget > 20000 ? seed.Budget - 15000 : seed.Budget + 15000, 'Effort (pts)': oldEffort },
      column_meta: auditColumnMeta(columns, ['Budget', 'Effort (pts)']),
    }),
    audit(1, 1, 72, 'DATA_INSERT', {
      data: { Launch: seed.Launch, Status: STATUS[0].title },
      column_meta: auditColumnMeta(columns, ['Launch', 'Status']),
    }),
  ]
}
