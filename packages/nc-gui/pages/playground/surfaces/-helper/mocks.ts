import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import type { ColumnType, FilterType, HookType, SortType, TableType } from 'nocodb-sdk'
import { HttpClient, UITypes } from 'nocodb-sdk'
import { getMockSession, installPlaygroundMocks } from '../../views/-helper/install'
import type { MockDb } from '../../views/-helper/mock-api'
import { COL, MOCK_BASE_ID, MOCK_USERS, buildTable, buildView, mockBase } from '../../views/-helper/mock-data'

/**
 * Surface pages reuse the views mock session for the grid table and layer a
 * small stateful adapter on top for toolbar config (filters, sorts, group-by),
 * webhooks and field create/update. Active only on `/playground/surfaces/...`.
 */
export const SURFACE_KIND = 'grid' as const

export const SURFACE_TABLE_ID = SURFACE_KIND

export const SURFACE_VIEW_ID = `vw-pg-${SURFACE_KIND}`

/**
 * Surface routes carry the same `baseId(views)/viewId(grid)/<slug>` params as
 * the view pages, so stores resolve the mock base/table/view from the route.
 */
export const surfaceRoute = (page: string) =>
  `/playground/surfaces/${page}/views/${SURFACE_KIND}/${toReadableUrlSlug([
    buildTable(SURFACE_KIND).title,
    buildView(SURFACE_KIND).title,
  ])}`

const SURFACE_PATH = /^\/playground\/surfaces\//

type MergeParams = (this: HttpClient, params1: AxiosRequestConfig, params2?: AxiosRequestConfig) => AxiosRequestConfig

interface ViewColumnPatch {
  show?: boolean
  group_by?: boolean
  group_by_order?: number
  group_by_sort?: string
  group_by_enabled?: boolean
  [key: string]: unknown
}

interface SurfaceState {
  filters: FilterType[]
  sorts: SortType[]
  hooks: (HookType & { condition?: boolean; created_at?: string })[]
  viewColumns: Record<string, ViewColumnPatch>
}

const now = () => new Date().toISOString()

let seq = 0
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}`

function initialState(): SurfaceState {
  const filter = (f: Partial<FilterType>): FilterType => ({
    fk_view_id: SURFACE_VIEW_ID,
    base_id: MOCK_BASE_ID,
    logical_op: 'and',
    is_group: false,
    ...f,
  })
  return {
    filters: [
      filter({ id: 'pgf-status', fk_column_id: COL.status, comparison_op: 'eq', value: 'In progress', order: 1 }),
      filter({ id: 'pgf-budget', fk_column_id: COL.budget, comparison_op: 'gt', value: '20000', order: 2 }),
      filter({ id: 'pgf-group', is_group: true, order: 3 }),
      filter({
        id: 'pgf-tags',
        fk_parent_id: 'pgf-group',
        fk_column_id: COL.tags,
        comparison_op: 'anyof',
        value: 'AI,API',
        order: 1,
      }),
      filter({
        id: 'pgf-approved',
        fk_parent_id: 'pgf-group',
        fk_column_id: COL.approved,
        comparison_op: 'checked',
        logical_op: 'or',
        order: 2,
      }),
    ],
    sorts: [
      { id: 'pgs-launch', fk_view_id: SURFACE_VIEW_ID, fk_column_id: COL.launch, direction: 'asc', order: 1 },
      { id: 'pgs-budget', fk_view_id: SURFACE_VIEW_ID, fk_column_id: COL.budget, direction: 'desc', order: 2 },
    ] as SortType[],
    hooks: [
      {
        id: 'pgh-slack',
        title: 'Notify #launches on Slack',
        event: 'after',
        operation: ['insert', 'update'],
        version: 'v3',
        active: true,
        fk_model_id: SURFACE_TABLE_ID,
        notification: { type: 'URL', payload: { method: 'POST', path: 'https://hooks.slack.com/services/T000/B000/XXXX' } },
        created_at: '2026-08-14T10:12:00.000Z',
      },
      {
        id: 'pgh-crm',
        title: 'Sync shipped launches to CRM',
        event: 'after',
        operation: ['update'],
        version: 'v3',
        active: false,
        condition: true,
        fk_model_id: SURFACE_TABLE_ID,
        notification: { type: 'URL', payload: { method: 'POST', path: 'https://crm.acme.dev/api/launches' } },
        created_at: '2026-09-02T16:40:00.000Z',
      },
    ],
    viewColumns: {
      [COL.status]: { group_by: true, group_by_order: 1, group_by_sort: 'asc' },
      [COL.owner]: { group_by: true, group_by_order: 2, group_by_sort: 'desc' },
    },
  }
}

const states = new WeakMap<MockDb, SurfaceState>()

function stateFor(db: MockDb) {
  let s = states.get(db)
  if (!s) {
    s = initialState()
    states.set(db, s)
  }
  return s
}

/** Column ids from `vc-<viewId>-<columnId>` view-column ids. */
const columnIdOf = (viewColumnId: string) => viewColumnId.replace(`vc-${SURFACE_VIEW_ID}-`, '')

function replaceTable(db: MockDb, columns: ColumnType[]): TableType {
  const table = db.tables[SURFACE_TABLE_ID]!
  const next = { ...table, columns, columnsById: Object.fromEntries(columns.map((c) => [c.id!, c])) } as TableType
  db.tables[SURFACE_TABLE_ID] = next
  return next
}

function columnFromPayload(payload: Record<string, any>, id: string, order: number): ColumnType {
  const { view_id: _v, column_order: _o, userHasChangedTitle: _u, ...rest } = payload
  return {
    ...rest,
    id,
    fk_model_id: SURFACE_TABLE_ID,
    base_id: MOCK_BASE_ID,
    column_name:
      rest.column_name ||
      String(rest.title ?? id)
        .toLowerCase()
        .replace(/\W+/g, '_'),
    order,
    system: false,
    meta: rest.meta ?? {},
  } as ColumnType
}

const OWN_OPS = new Set([
  'filterList',
  'filterChildrenList',
  'filterCreate',
  'filterUpdate',
  'filterDelete',
  'sortList',
  'sortCreate',
  'sortUpdate',
  'sortDelete',
  'viewColumnList',
  'viewColumnUpdate',
  'gridColumnUpdate',
  'showAllColumns',
  'hideAllColumns',
  'gridViewUpdate',
  'viewUpdate',
  'hookList',
  'hookCreate',
  'hookUpdate',
  'hookDelete',
  'columnUpdate',
  'columnAdd',
  'columnDelete',
  'columnsBulk',
  'mcpList',
  'baseTrashSettingsList',
])

/** Returns `undefined` for operations the base views adapter should answer. */
function handle(db: MockDb, op: string, q: Record<string, any>, payload: any): unknown {
  const s = stateFor(db)
  const table = db.tables[SURFACE_TABLE_ID]!
  switch (op) {
    case 'filterList':
      return { list: s.filters.filter((f) => !f.fk_parent_id) }
    case 'filterChildrenList':
      return { list: s.filters.filter((f) => f.fk_parent_id === q.filterId) }
    case 'filterCreate': {
      const filter = { ...payload, id: nextId('pgf'), fk_view_id: q.viewId } as FilterType
      s.filters.push(filter)
      return filter
    }
    case 'filterUpdate': {
      const filter = s.filters.find((f) => f.id === q.filterId)
      if (filter) Object.assign(filter, payload)
      return filter ?? { ...payload, id: q.filterId }
    }
    case 'filterDelete':
      s.filters = s.filters.filter((f) => f.id !== q.filterId && f.fk_parent_id !== q.filterId)
      return {}
    case 'sortList':
      return { list: s.sorts }
    case 'sortCreate': {
      const sort = { ...payload, id: nextId('pgs'), fk_view_id: q.viewId } as SortType
      s.sorts.push(sort)
      return sort
    }
    case 'sortUpdate': {
      const sort = s.sorts.find((x) => x.id === q.sortId)
      if (sort) Object.assign(sort, payload)
      return sort ?? {}
    }
    case 'sortDelete':
      s.sorts = s.sorts.filter((x) => x.id !== q.sortId)
      return {}
    case 'viewColumnUpdate':
    case 'gridColumnUpdate': {
      const colId = q.columnId ?? columnIdOf(q.gridViewColumnId ?? '')
      s.viewColumns[colId] = { ...s.viewColumns[colId], ...payload }
      return { id: `vc-${SURFACE_VIEW_ID}-${colId}`, fk_column_id: colId, ...s.viewColumns[colId] }
    }
    case 'showAllColumns':
    case 'hideAllColumns':
      for (const c of table.columns ?? []) {
        if (c.pv) continue
        s.viewColumns[c.id!] = { ...s.viewColumns[c.id!], show: op === 'showAllColumns' }
      }
      return {}
    case 'gridViewUpdate': {
      const view = db.views[q.viewId ?? SURFACE_VIEW_ID]
      if (view) view.view = { ...(view.view as object), ...payload } as typeof view.view
      return view?.view ?? {}
    }
    case 'viewUpdate': {
      const view = db.views[q.viewId ?? SURFACE_VIEW_ID]
      if (view) Object.assign(view, payload)
      return view ?? {}
    }
    case 'hookList':
      return { list: s.hooks.filter((h) => h.fk_model_id === (q.tableId ?? SURFACE_TABLE_ID)) }
    case 'hookCreate': {
      const hook = { ...payload, id: nextId('pgh'), fk_model_id: q.tableId, created_at: now() } as HookType
      s.hooks.push(hook)
      return hook
    }
    case 'hookUpdate': {
      const hook = s.hooks.find((h) => h.id === q.hookId)
      if (hook) Object.assign(hook, payload)
      return hook ?? {}
    }
    case 'hookDelete':
      s.hooks = s.hooks.filter((h) => h.id !== q.hookId)
      return {}
    case 'columnUpdate': {
      const columns = (table.columns ?? []).map((c) => (c.id === q.columnId ? { ...c, ...payload, id: c.id } : c))
      replaceTable(db, columns as ColumnType[])
      return columns.find((c) => c.id === q.columnId) ?? {}
    }
    case 'columnAdd': {
      const columns = [...(table.columns ?? [])]
      columns.push(columnFromPayload(payload ?? {}, nextId('pgc'), columns.length + 1))
      return replaceTable(db, columns)
    }
    case 'columnsBulk': {
      let columns = [...(table.columns ?? [])]
      for (const { op: kind, column } of (payload?.ops ?? []) as Array<{ op: string; column: Record<string, any> }>) {
        if (kind === 'add') columns.push(columnFromPayload(column, nextId('pgc'), columns.length + 1))
        else if (kind === 'update') columns = columns.map((c) => (c.id === column.id ? { ...c, ...column } : c))
        else if (kind === 'delete') columns = columns.filter((c) => c.id !== column.id)
      }
      for (const v of (payload?.visibility ?? []) as Array<{ columnId: string; column: Record<string, unknown> }>) {
        s.viewColumns[v.columnId] = { ...s.viewColumns[v.columnId], show: !!v.column.show }
      }
      replaceTable(db, columns as ColumnType[])
      return { failedOps: [] }
    }
    case 'mcpList':
      return []
    case 'baseTrashSettingsList':
      return {
        defaultRetentionDays: 30,
        tables: Object.values(db.tables).map((t) => ({
          id: t.id,
          title: t.title,
          trash_disabled: false,
          trash_retention_days: null,
          is_meta: true,
          has_deleted_column: true,
        })),
      }
    case 'columnDelete':
      return replaceTable(
        db,
        (table.columns ?? []).filter((c) => c.id !== q.columnId),
      )
    default:
      return undefined
  }
}

/** Overlays group-by / visibility state on the base adapter's view columns. */
function patchViewColumns(db: MockDb, data: any) {
  const s = stateFor(db)
  const list = (data?.list ?? []).map((vc: Record<string, any>) => ({ ...vc, ...s.viewColumns[vc.fk_column_id] }))
  // columns added through the field editor have no base view column yet
  const known = new Set(list.map((vc: Record<string, any>) => vc.fk_column_id))
  for (const c of db.tables[SURFACE_TABLE_ID]?.columns ?? []) {
    if (known.has(c.id) || c.system || c.uidt === UITypes.ID) continue
    list.push({
      id: `vc-${SURFACE_VIEW_ID}-${c.id}`,
      fk_view_id: SURFACE_VIEW_ID,
      fk_column_id: c.id,
      show: true,
      order: list.length + 1,
      width: '180px',
      ...s.viewColumns[c.id!],
    })
  }
  return { ...data, list }
}

function parseBody(data: unknown) {
  if (typeof data !== 'string') return data
  try {
    return JSON.parse(data)
  } catch {
    return data
  }
}

// base-settings panes that go through the REST client rather than the internal API
const REST_ROUTES: Array<[RegExp, (db: MockDb) => unknown]> = [
  [
    new RegExp(`/api/v1/db/meta/projects/${MOCK_BASE_ID}/users`),
    () => ({
      users: {
        list: MOCK_USERS.map((u, i) => ({
          ...u,
          roles: i === 0 ? 'owner' : i < 3 ? 'editor' : 'viewer',
          created_at: `2026-0${3 + i}-1${i}T10:00:00.000Z`,
        })),
        pageInfo: { totalRows: MOCK_USERS.length, page: 1, pageSize: 25, isFirstPage: true, isLastPage: true },
      },
    }),
  ],
  [
    new RegExp(`/api/v1/db/meta/projects/${MOCK_BASE_ID}/bases/?$`),
    () => ({
      list: mockBase().sources.map((s) => ({ ...s, alias: null, config: null, created_at: '2026-08-01T09:00:00.000Z' })),
    }),
  ],
  [new RegExp(`/api/v2/meta/bases/${MOCK_BASE_ID}/snapshot-schedule`), () => ({})],
  [new RegExp(`/api/v2/meta/bases/${MOCK_BASE_ID}/snapshots`), () => []],
]

function createSurfaceAdapter(base: AxiosAdapter): AxiosAdapter {
  const respond = async (config: InternalAxiosRequestConfig, data: unknown): Promise<AxiosResponse> => {
    await new Promise((resolve) => setTimeout(resolve, 40))
    return { data, status: 200, statusText: 'OK', headers: {}, config, request: {} }
  }

  const single = async (config: InternalAxiosRequestConfig, db: MockDb, op: string, q: Record<string, any>, payload: any) => {
    const mine = handle(db, op, q, payload)
    if (mine !== undefined) return mine
    const res = await base({
      ...config,
      method: payload === undefined ? 'get' : 'post',
      params: { ...q, operation: op },
      data: payload === undefined ? undefined : JSON.stringify(payload),
    })
    return op === 'viewColumnList' && (!q.viewId || q.viewId === SURFACE_VIEW_ID) ? patchViewColumns(db, res.data) : res.data
  }

  return async (config) => {
    const db = getMockSession()?.db
    const url = config.url ?? ''
    if (!db || !SURFACE_PATH.test(window.location.pathname)) return base(config)

    const rest = REST_ROUTES.find(([re]) => re.test(url))
    if (rest) return respond(config, rest[1](db))

    if (!/\/api\/v2\/internal\//.test(url)) return base(config)

    const q = { ...(config.params ?? {}) }
    const body = parseBody(config.data)
    if (q.operation !== 'batch') {
      if (!OWN_OPS.has(q.operation)) return base(config)
      return respond(config, await single(config, db, q.operation, q, body))
    }

    const results = await Promise.all(
      (body?.operations ?? []).map(async (op: { operation: string; query?: Record<string, any>; payload?: any }) => ({
        status: 200,
        data: await single(config, db, op.operation, { ...op.query }, op.payload),
      })),
    )
    return respond(config, { results })
  }
}

let wrapped: MergeParams | null = null

let interceptorId: number | null = null

let guardRegistered = false

/**
 * The views install pins `config.adapter` from a request interceptor on
 * `$api.instance`, which would overwrite a plain wrapper — so the adapter
 * becomes an accessor that keeps wrapping whatever gets assigned.
 */
function pinSurfaceAdapter(config: InternalAxiosRequestConfig) {
  let base = config.adapter as AxiosAdapter | undefined
  Object.defineProperty(config, 'adapter', {
    configurable: true,
    enumerable: true,
    get: () => (base ? createSurfaceAdapter(base) : base),
    set: (v) => {
      base = v
    },
  })
  return config
}

/** Call from the page's route middleware and again from setup (HMR remounts). */
export function installSurfaceMocks() {
  installPlaygroundMocks(SURFACE_KIND)
  const nuxtApp = useNuxtApp()

  if (HttpClient.prototype.mergeRequestParams !== wrapped) {
    const inner = HttpClient.prototype.mergeRequestParams as MergeParams
    wrapped = function (params1, params2) {
      const config = inner.call(this, params1, params2)
      return config.adapter ? { ...config, adapter: createSurfaceAdapter(config.adapter as AxiosAdapter) } : config
    } satisfies MergeParams
    HttpClient.prototype.mergeRequestParams = wrapped
  }

  if (interceptorId === null) interceptorId = nuxtApp.$api.instance.interceptors.request.use(pinSurfaceAdapter)

  if (!guardRegistered) {
    guardRegistered = true
    nuxtApp.$router.afterEach((to) => {
      if (SURFACE_PATH.test(to.path) || interceptorId === null) return
      nuxtApp.$api.instance.interceptors.request.eject(interceptorId)
      interceptorId = null
    })
  }
}
