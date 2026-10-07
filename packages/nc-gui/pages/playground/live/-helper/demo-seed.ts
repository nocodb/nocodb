import { ViewTypes } from 'nocodb-sdk'
import type { Api } from 'nocodb-sdk'

export const DEMO_STORAGE_KEY = 'nc-playground-demo-base'

export const DEMO_BASE_TITLE = 'Design Playground'

export const DEMO_VIEW_LABELS: Record<DemoViewKey, string> = {
  grid: 'Grid',
  gallery: 'Gallery',
  kanban: 'Kanban',
  calendar: 'Calendar',
  form: 'Form',
  timeline: 'Timeline',
}

export type DemoViewKey = 'grid' | 'gallery' | 'kanban' | 'calendar' | 'form' | 'timeline'

export interface DemoBase {
  workspaceId: string
  baseId: string
  tableId: string
  teamsTableId: string
  views: Partial<Record<DemoViewKey, string>>
  createdAt: string
}

export interface SeedStep {
  key: string
  label: string
  status: 'pending' | 'running' | 'done' | 'warning' | 'error'
  message?: string
}

interface V3Field {
  id: string
  title: string
}

interface V3Table {
  id: string
  fields: V3Field[]
}

export const SEED_STEPS: Array<Pick<SeedStep, 'key' | 'label'>> = [
  { key: 'base', label: `Create base "${DEMO_BASE_TITLE}"` },
  { key: 'teams', label: 'Create Teams table + rows' },
  { key: 'table', label: 'Create Projects table with every field type' },
  { key: 'derived', label: 'Add links, lookup, rollup, formula, barcode, QR' },
  { key: 'rows', label: 'Insert 30 project rows' },
  { key: 'links', label: 'Link projects to teams' },
  { key: 'views', label: 'Create Gallery, Kanban, Calendar, Form, Timeline views' },
]

const STATUSES = [
  { title: 'Backlog', color: '#cfdffe' },
  { title: 'Planned', color: '#d0f1fd' },
  { title: 'In progress', color: '#fee2d5' },
  { title: 'In review', color: '#ffeab6' },
  { title: 'Done', color: '#d1f7c4' },
]

const TAGS = [
  { title: 'Design', color: '#ffdaf6' },
  { title: 'Frontend', color: '#cfdffe' },
  { title: 'Backend', color: '#ede2fe' },
  { title: 'Research', color: '#d0f1fd' },
  { title: 'Marketing', color: '#ffeab6' },
  { title: 'Infra', color: '#eeeeee' },
]

const TEAMS = [
  { Name: 'Atlas', Lead: 'Priya Raman', Region: 'EMEA' },
  { Name: 'Beacon', Lead: 'Marcus Lee', Region: 'Americas' },
  { Name: 'Comet', Lead: 'Aiko Tanaka', Region: 'APAC' },
  { Name: 'Delta', Lead: 'Sofia Rossi', Region: 'EMEA' },
  { Name: 'Echo', Lead: 'Daniel Okafor', Region: 'Americas' },
]

const PROJECT_NAMES = [
  'Onboarding revamp',
  'Billing v2',
  'Mobile grid gestures',
  'Dark mode polish',
  'Kanban swimlanes',
  'Audit log export',
  'Formula autocomplete',
  'Calendar drag & drop',
  'SSO for teams',
  'Webhook retries',
  'Form logic branches',
  'Gallery cover crop',
  'API rate limits',
  'Search relevance',
  'Import from Airtable',
  'Record templates',
  'Comment mentions',
  'Row colouring',
  'Timeline zoom',
  'Field permissions',
  'Snapshot restore',
  'Locale formats',
  'Barcode scanner',
  'Map clustering',
  'Docs embeds',
  'Workspace analytics',
  'Plan upgrade flow',
  'Accessibility pass',
  'Icon refresh',
  'Design token audit',
]

const DESCRIPTIONS = [
  'Rework the first-run experience so new users reach their first table in under a minute.',
  'Migrate subscriptions to the new billing engine with prorated seat changes.',
  'Ship touch-friendly scrolling and selection for the canvas grid on tablets.',
  'Tune contrast, borders and elevation across every surface in the dark theme.',
]

function img(seed: number) {
  return [
    {
      url: `https://picsum.photos/seed/nc-playground-${seed}/640/400`,
      title: `cover-${seed}.jpg`,
      mimetype: 'image/jpeg',
    },
  ]
}

function pick<T>(list: T[], i: number) {
  return list[i % list.length]
}

function buildRows(userEmail: string | undefined, withAttachments: boolean) {
  const today = new Date()
  return PROJECT_NAMES.map((name, i) => {
    const start = new Date(today.getFullYear(), today.getMonth(), 1 + ((i * 3) % 27))
    const due = new Date(start.getTime() + (3 + (i % 9)) * 86400000)
    const fields: Record<string, unknown> = {
      'Name': name,
      'Description': pick(DESCRIPTIONS, i),
      'Status': pick(STATUSES, i).title,
      'Tags': [pick(TAGS, i).title, pick(TAGS, i + 2).title].join(','),
      'Priority': (i % 5) + 1,
      'Story points': (i * 7) % 21,
      'Budget': 1200 + i * 875.5,
      'Progress': (i * 13) % 100,
      'Estimate': 3600 * (1 + (i % 12)) + 900 * (i % 4),
      'Velocity': Number((1.25 + (i % 7) * 0.4).toFixed(2)),
      'Shipped': i % 3 === 0,
      'Start': start.toISOString().slice(0, 10),
      'Due': due.toISOString().slice(0, 10),
      'Kickoff': new Date(start.getTime() + 10 * 3600000).toISOString(),
      'Owner email': `owner${i + 1}@example.com`,
      'Phone': `+1 415 555 ${String(1000 + i * 37).slice(-4)}`,
      'Website': `https://example.com/projects/${i + 1}`,
      'Config': { flag: `exp_${i}`, rollout: (i * 10) % 100, regions: ['eu', 'us'] },
      'SKU': `NC-${String(10000 + i * 137)}`,
    }
    if (userEmail) fields.Assignee = [{ email: userEmail }]
    if (withAttachments) fields.Cover = img(i + 1)
    return { fields }
  })
}

export async function seedDemoBase({
  api,
  workspaceId,
  userEmail,
  createBase,
  onStep,
  skipViews = [],
}: {
  api: Api<unknown>
  workspaceId: string
  userEmail?: string
  /** views the plan doesn't include; requesting them 403s */
  skipViews?: DemoViewKey[]
  createBase: (title: string) => Promise<{ id?: string }>
  onStep: (key: string, status: SeedStep['status'], message?: string) => void
}): Promise<DemoBase> {
  const http = api.instance

  async function run<T>(key: string, fn: (warn: (msg: string) => void) => Promise<T>): Promise<T> {
    onStep(key, 'running')
    let warning: string | undefined
    try {
      const result = await fn((msg) => (warning = msg))
      onStep(key, warning ? 'warning' : 'done', warning)
      return result
    } catch (e: any) {
      onStep(key, 'error', await extractSdkResponseErrorMsg(e))
      throw e
    }
  }

  const base = await run('base', () => createBase(DEMO_BASE_TITLE))
  const baseId = base.id!

  // v3 data API caps bulk writes at 10 records per request
  async function insertRecords(tableId: string, rows: Array<{ fields: Record<string, unknown> }>) {
    const ids: Array<number | string> = []
    for (let i = 0; i < rows.length; i += 10) {
      const { data } = await http.post<{ records: Array<{ id: number | string }> }>(
        `/api/v3/data/${baseId}/${tableId}/records`,
        rows.slice(i, i + 10),
      )
      ids.push(...data.records.map((r) => r.id))
    }
    return ids
  }

  const teams = await run('teams', async () => {
    const { data } = await http.post<V3Table>(`/api/v3/meta/bases/${baseId}/tables`, {
      title: 'Teams',
      fields: [
        { title: 'Name', type: 'SingleLineText' },
        { title: 'Lead', type: 'SingleLineText' },
        {
          title: 'Region',
          type: 'SingleSelect',
          options: {
            choices: [
              { title: 'EMEA', color: '#cfdffe' },
              { title: 'Americas', color: '#d1f7c4' },
              { title: 'APAC', color: '#ffeab6' },
            ],
          },
        },
      ],
    })
    return {
      ...data,
      recordIds: await insertRecords(
        data.id,
        TEAMS.map((fields) => ({ fields })),
      ),
    }
  })

  const table = await run('table', async () => {
    const { data } = await http.post<V3Table>(`/api/v3/meta/bases/${baseId}/tables`, {
      title: 'Projects',
      fields: [
        { title: 'Name', type: 'SingleLineText' },
        { title: 'Description', type: 'LongText' },
        { title: 'Status', type: 'SingleSelect', options: { choices: STATUSES } },
        { title: 'Tags', type: 'MultiSelect', options: { choices: TAGS } },
        { title: 'Priority', type: 'Rating', options: { icon: 'star', max_value: 5, color: '#fcb401' } },
        { title: 'Story points', type: 'Number' },
        { title: 'Budget', type: 'Currency', options: { currency_locale: 'en-US', currency_code: 'USD', precision: 2 } },
        { title: 'Progress', type: 'Percent', options: { show_as_progress: true, precision: 0 } },
        { title: 'Estimate', type: 'Duration', options: { duration_format: 'h:mm' } },
        { title: 'Velocity', type: 'Decimal', options: { precision: 2 } },
        { title: 'Shipped', type: 'Checkbox' },
        { title: 'Start', type: 'Date', options: { date_format: 'YYYY-MM-DD' } },
        { title: 'Due', type: 'Date', options: { date_format: 'YYYY-MM-DD' } },
        { title: 'Kickoff', type: 'DateTime', options: { date_format: 'YYYY-MM-DD', time_format: 'HH:mm' } },
        { title: 'Owner email', type: 'Email' },
        { title: 'Phone', type: 'PhoneNumber' },
        { title: 'Website', type: 'URL' },
        { title: 'Config', type: 'JSON' },
        { title: 'Cover', type: 'Attachment' },
        { title: 'Assignee', type: 'User' },
        { title: 'SKU', type: 'SingleLineText' },
      ],
    })
    return data
  })

  const field = (t: V3Table, title: string) => t.fields.find((f) => f.title === title)!.id

  const linkFieldId = await run('derived', async (warn) => {
    const fieldsUrl = `/api/v3/meta/bases/${baseId}/tables/${table.id}/fields`
    const { data: link } = await http.post<V3Field>(fieldsUrl, {
      title: 'Teams',
      type: 'Links',
      options: { relation_type: 'mm', related_table_id: teams.id },
    })
    const optional = [
      {
        title: 'Team lead',
        type: 'Lookup',
        options: { related_field_id: link.id, related_table_lookup_field_id: field(teams, 'Lead') },
      },
      {
        title: 'Team count',
        type: 'Rollup',
        options: { related_field_id: link.id, related_table_rollup_field_id: field(teams, 'Name'), rollup_function: 'count' },
      },
      { title: 'Summary', type: 'Formula', options: { formula: 'CONCAT({Name}, " · ", {Status})' } },
      { title: 'Barcode', type: 'Barcode', options: { barcode_format: 'CODE128', barcode_value_field_id: field(table, 'SKU') } },
      { title: 'QR', type: 'QrCode', options: { qrcode_value_field_id: field(table, 'Website') } },
    ]
    const failed: string[] = []
    for (const body of optional) {
      try {
        await http.post(fieldsUrl, body)
      } catch {
        failed.push(body.title)
      }
    }
    if (failed.length) warn(`Skipped: ${failed.join(', ')}`)
    return link.id
  })

  const recordIds = await run('rows', async (warn) => {
    try {
      return await insertRecords(table.id, buildRows(userEmail, true))
    } catch {
      // attachment URLs need outbound network on the backend; retry without covers
      const ids = await insertRecords(table.id, buildRows(userEmail, false))
      warn('Inserted without cover images (backend could not fetch the image URLs)')
      return ids
    }
  })

  await run('links', async () => {
    await Promise.all(
      recordIds.map((id, i) =>
        http.post(`/api/v3/data/${baseId}/${table.id}/links/${linkFieldId}/${id}`, [
          { id: pick(teams.recordIds, i) },
          ...(i % 4 === 0 ? [{ id: pick(teams.recordIds, i + 2) }] : []),
        ]),
      ),
    )
  })

  // the v3 view API is plan-gated, so use the internal ops the view-create dialog uses
  const views = await run('views', async (warn) => {
    const { list } = (await api.internal.getOperation(workspaceId, baseId, { operation: 'viewList', tableId: table.id })) as {
      list: Array<{ id: string; type: number }>
    }
    const result: DemoBase['views'] = { grid: list.find((v) => v.type === ViewTypes.GRID)?.id }
    const specs: Array<[DemoViewKey, string, Record<string, unknown>]> = [
      [
        'gallery',
        'galleryViewCreate',
        { title: 'Gallery', type: ViewTypes.GALLERY, fk_cover_image_col_id: field(table, 'Cover') },
      ],
      [
        'kanban',
        'kanbanViewCreate',
        {
          title: 'Kanban',
          type: ViewTypes.KANBAN,
          fk_grp_col_id: field(table, 'Status'),
          fk_cover_image_col_id: field(table, 'Cover'),
        },
      ],
      [
        'calendar',
        'calendarViewCreate',
        { title: 'Calendar', type: ViewTypes.CALENDAR, calendar_range: [{ fk_from_column_id: field(table, 'Start') }] },
      ],
      ['form', 'formViewCreate', { title: 'Form', type: ViewTypes.FORM, ...getDefaultViewMetas(ViewTypes.FORM) }],
      [
        'timeline',
        'timelineViewCreate',
        {
          title: 'Timeline',
          type: ViewTypes.TIMELINE,
          timeline_range: [{ fk_from_column_id: field(table, 'Start'), fk_to_column_id: field(table, 'Due') }],
        },
      ],
    ]
    const failed: string[] = []
    for (const [key, operation, body] of specs) {
      if (skipViews.includes(key)) continue
      try {
        const data = (await api.internal.postOperation(workspaceId, baseId, { operation, tableId: table.id }, body)) as {
          id: string
        }
        result[key] = data.id
      } catch (e: any) {
        failed.push(`${key} (${await extractSdkResponseErrorMsg(e)})`)
      }
    }
    if (failed.length) warn(`Skipped: ${failed.join('; ')}`)
    return result
  })

  return {
    workspaceId,
    baseId,
    tableId: table.id,
    teamsTableId: teams.id,
    views,
    createdAt: new Date().toISOString(),
  }
}
