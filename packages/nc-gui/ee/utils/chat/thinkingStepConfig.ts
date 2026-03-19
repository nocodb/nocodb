import type { RecordColumnMeta } from 'nocodb-sdk'
import type { FieldBadge, StepConfig, ToolUseBlock } from './thinkingTypes'
import { OP_LABELS, bold, collectFieldBadgesFromBlocks, esc, parseWhere, renderFilterTree } from './thinkingUtils'

export type { FieldBadge, StepCategory, StepConfig, ThinkingStep, ToolUseBlock, WebSource } from './thinkingTypes'

function inp(block: ToolUseBlock): Record<string, any> {
  return (block.input as Record<string, any>) || {}
}

function tableMention(blocks: ToolUseBlock[]) {
  return { tableName: inp(blocks[0]).table_name as string | undefined, fieldBadges: [] as FieldBadge[] }
}

function whereDesc(block: ToolUseBlock): string {
  const where = inp(block).where
  if (!where || typeof where !== 'string') return ''
  const cols = (block.metadata as any)?.model?.columns as RecordColumnMeta[] | undefined
  const filters = parseWhere(where, cols)
  return filters.length ? `where ${renderFilterTree(filters)}` : ''
}

function filterInputDesc(block: ToolUseBlock): string {
  const input = inp(block)
  if (input.where || input.filter) {
    const cols = (block.metadata as any)?.model?.columns as RecordColumnMeta[] | undefined
    const filters = parseWhere(input.where || input.filter, cols)
    if (filters.length) return renderFilterTree(filters)
  }
  if (input.field && input.comparison_op) {
    const opLabel = OP_LABELS[input.comparison_op] || input.comparison_op
    const val = input.value != null ? ` "${esc(String(input.value))}"` : ''
    return `${bold(input.field)} ${esc(opLabel)}${val}`
  }
  return ''
}

export function getRecordCount(blocks: ToolUseBlock[]): string {
  let total = 0
  let found = false
  for (const b of blocks) {
    if (!b.output) continue
    try {
      const out = typeof b.output === 'string' ? JSON.parse(b.output) : b.output
      if (out?.totalRows !== undefined) {
        total += Number(out.totalRows)
        found = true
      } else if (out?.count !== undefined) {
        total += Number(out.count)
        found = true
      } else if (Array.isArray(out?.records)) {
        total += out.records.length
        found = true
      } else if (Array.isArray(out)) {
        total += out.length
        found = true
      }
    } catch {
      /* ignore */
    }
  }
  return found ? String(total) : 'some'
}

export const STEP_CONFIG: Record<string, StepConfig> = {
  // ─── Data querying ────────────────────────────────────────────────────────
  query_records: {
    category: 'search',
    icon: 'ncSearch',
    labelFn: () => 'Searching records',
    descriptionFn: (block) => whereDesc(block),
    mentionsFn: (blocks) => ({ tableName: inp(blocks[0]).table_name, fieldBadges: collectFieldBadgesFromBlocks(blocks) }),
  },
  aggregate: {
    category: 'search',
    icon: 'ncSearch',
    labelFn: (b) => {
      const input = inp(b[0])
      const fn = (input.function || input.type || '').toLowerCase()
      const field = input.field
      if (fn === 'count') return field ? `Counting ${field}` : 'Counting records'
      if (fn === 'sum') return field ? `Summing ${field}` : 'Summing values'
      if (fn === 'avg' || fn === 'average') return field ? `Averaging ${field}` : 'Averaging values'
      if (fn === 'min') return field ? `Finding minimum ${field}` : 'Finding minimum'
      if (fn === 'max') return field ? `Finding maximum ${field}` : 'Finding maximum'
      if (fn && field) return `Computing ${fn} of ${field}`
      if (field) return `Computing statistics on ${field}`
      return 'Computing statistics'
    },
    descriptionFn: (block) => {
      const parts: string[] = []
      const input = inp(block)
      if (input.function || input.type) parts.push(esc(input.function || input.type))
      if (input.field) parts.push(`on ${bold(input.field)}`)
      const where = whereDesc(block)
      if (where) parts.push(where)
      return parts.join(' ')
    },
    mentionsFn: tableMention,
  },
  list_linked_records: {
    category: 'search',
    icon: 'ncSearch',
    labelFn: () => 'Searching linked records',
    descriptionFn: (block) => {
      const f = inp(block).link_field_name || inp(block).field
      return f ? `via ${bold(f)}` : ''
    },
    mentionsFn: tableMention,
  },

  // ─── Schema discovery ─────────────────────────────────────────────────────
  list_tables: { category: 'search', icon: 'ncSearch', labelFn: () => 'Identifying relevant data' },
  describe_table: { category: 'search', icon: 'ncSearch', labelFn: () => 'Identifying relevant data', mentionsFn: tableMention },
  list_views: { category: 'search', icon: 'ncSearch', labelFn: () => 'Checking available views', mentionsFn: tableMention },
  list_view_fields: {
    category: 'search',
    icon: 'ncSearch',
    labelFn: () => 'Checking available fields',
    mentionsFn: tableMention,
  },
  list_filters: { category: 'search', icon: 'ncSearch', labelFn: () => 'Viewing existing filters', mentionsFn: tableMention },
  list_sorts: { category: 'search', icon: 'ncSearch', labelFn: () => 'Viewing existing sort order', mentionsFn: tableMention },

  list_dashboards: { category: 'search', icon: 'ncSearch', labelFn: () => 'Checking available dashboards' },
  list_widgets: { category: 'search', icon: 'ncSearch', labelFn: () => 'Checking available charts' },
  list_widget_filters: { category: 'search', icon: 'ncSearch', labelFn: () => 'Viewing chart filters' },
  get_dashboard: {
    category: 'search',
    icon: 'ncSearch',
    labelFn: () => 'Opening dashboard',
    descriptionFn: (b) => {
      const n = inp(b).dashboard_name || inp(b).title
      return n ? bold(n) : ''
    },
  },
  get_widget: {
    category: 'search',
    icon: 'ncSearch',
    labelFn: () => 'Loading chart',
    descriptionFn: (b) => {
      const n = inp(b).title || inp(b).widget_name
      return n ? bold(n) : ''
    },
  },
  get_widget_data: { category: 'search', icon: 'ncSearch', labelFn: () => 'Loading chart data' },

  create_table: {
    category: 'create',
    icon: 'ncPlus',
    labelFn: () => 'Building table',
    descriptionFn: (b) => {
      const n = inp(b).title || inp(b).table_name
      return n ? bold(n) : ''
    },
  },
  add_field: {
    category: 'create',
    icon: 'ncPlus',
    labelFn: () => 'Adding fields',
    descriptionFn: (b) => {
      const { title, uidt } = inp(b)
      return [title ? bold(title) : '', uidt ? esc(uidt) : ''].filter(Boolean).join(' · ')
    },
    mentionsFn: tableMention,
  },
  create_view: {
    category: 'create',
    icon: 'ncPlus',
    labelFn: () => 'Creating view',
    descriptionFn: (b) => {
      const { title, view_type } = inp(b)
      return title ? `${view_type ? `${esc(view_type)} ` : ''}${bold(title)}` : ''
    },
    mentionsFn: tableMention,
  },
  create_records: {
    category: 'create',
    icon: 'ncPlus',
    labelFn: () => 'Adding records',
    mentionsFn: tableMention,
  },
  create_dashboard: {
    category: 'create',
    icon: 'ncPlus',
    labelFn: () => 'Creating dashboard',
    descriptionFn: (b) => {
      const n = inp(b).title
      return n ? bold(n) : ''
    },
  },
  create_widget: {
    category: 'create',
    icon: 'ncPlus',
    labelFn: () => 'Adding chart',
    descriptionFn: (b) => {
      const n = inp(b).title
      return n ? bold(n) : ''
    },
  },
  duplicate_widget: { category: 'create', icon: 'ncPlus', labelFn: () => 'Duplicating chart' },

  update_records: {
    category: 'update',
    icon: 'ncEdit',
    labelFn: () => 'Updating records',
    mentionsFn: tableMention,
  },
  modify_field: {
    category: 'update',
    icon: 'ncEdit',
    labelFn: () => 'Updating field settings',
    descriptionFn: (b) => {
      const n = inp(b).title
      return n ? bold(n) : ''
    },
    mentionsFn: tableMention,
  },
  rename_table: {
    category: 'update',
    icon: 'ncEdit',
    labelFn: () => 'Renaming table',
    descriptionFn: (b) => {
      const n = inp(b).title
      return n ? `to ${bold(n)}` : ''
    },
  },
  rename_view: {
    category: 'update',
    icon: 'ncEdit',
    labelFn: () => 'Renaming view',
    descriptionFn: (b) => {
      const n = inp(b).title
      return n ? `to ${bold(n)}` : ''
    },
  },
  update_view_fields: { category: 'update', icon: 'ncEdit', labelFn: () => 'Updating visible fields', mentionsFn: tableMention },
  set_display_field: {
    category: 'update',
    icon: 'ncEdit',
    labelFn: () => 'Setting primary field',
    descriptionFn: (b) => {
      const n = inp(b).field_name || inp(b).field
      return n ? bold(n) : ''
    },
    mentionsFn: tableMention,
  },
  update_dashboard: {
    category: 'update',
    icon: 'ncEdit',
    labelFn: () => 'Updating dashboard',
    descriptionFn: (b) => {
      const n = inp(b).title
      return n ? bold(n) : ''
    },
  },
  update_widget: {
    category: 'update',
    icon: 'ncEdit',
    labelFn: () => 'Updating chart',
    descriptionFn: (b) => {
      const n = inp(b).title
      return n ? bold(n) : ''
    },
  },
  add_filter: {
    category: 'update',
    icon: 'ncEdit',
    labelFn: () => 'Applying filter',
    descriptionFn: filterInputDesc,
    mentionsFn: tableMention,
  },
  remove_filter: { category: 'update', icon: 'ncEdit', labelFn: () => 'Removing filter', mentionsFn: tableMention },
  add_sort: {
    category: 'update',
    icon: 'ncEdit',
    labelFn: () => 'Sorting results',
    descriptionFn: (b) => {
      const { field, direction } = inp(b)
      return field ? `${bold(field)} ${direction === 'desc' ? '↓' : '↑'}` : ''
    },
    mentionsFn: tableMention,
  },
  remove_sort: { category: 'update', icon: 'ncEdit', labelFn: () => 'Removing sort', mentionsFn: tableMention },
  set_group_by: {
    category: 'update',
    icon: 'ncEdit',
    labelFn: () => 'Grouping records',
    descriptionFn: (b) => {
      const f = inp(b).field
      return f ? `by ${bold(f)}` : ''
    },
    mentionsFn: tableMention,
  },
  clear_group_by: { category: 'update', icon: 'ncEdit', labelFn: () => 'Removing grouping', mentionsFn: tableMention },
  add_widget_filter: { category: 'update', icon: 'ncEdit', labelFn: () => 'Filtering chart' },
  remove_widget_filter: { category: 'update', icon: 'ncEdit', labelFn: () => 'Removing chart filter' },

  delete_table: { category: 'delete', icon: 'ncTrash2', labelFn: () => 'Deleting table' },
  delete_field: {
    category: 'delete',
    icon: 'ncTrash2',
    labelFn: () => 'Deleting field',
    descriptionFn: (b) => {
      const n = inp(b).title || inp(b).field_name
      return n ? bold(n) : ''
    },
    mentionsFn: tableMention,
  },
  delete_view: { category: 'delete', icon: 'ncTrash2', labelFn: () => 'Deleting view', mentionsFn: tableMention },
  delete_records: {
    category: 'delete',
    icon: 'ncTrash2',
    labelFn: () => 'Deleting records',
    mentionsFn: tableMention,
  },
  delete_dashboard: { category: 'delete', icon: 'ncTrash2', labelFn: () => 'Deleting dashboard' },
  delete_widget: { category: 'delete', icon: 'ncTrash2', labelFn: () => 'Deleting chart' },

  // ─── Link ─────────────────────────────────────────────────────────────────
  link_records: {
    category: 'link',
    icon: 'ncLink',
    labelFn: () => 'Linking records',
    descriptionFn: (b) => {
      const f = inp(b).link_field_name || inp(b).field
      return f ? `via ${bold(f)}` : ''
    },
  },
  unlink_records: {
    category: 'link',
    icon: 'ncLink',
    labelFn: () => 'Unlinking records',
    descriptionFn: (b) => {
      const f = inp(b).link_field_name || inp(b).field
      return f ? `via ${bold(f)}` : ''
    },
  },

  // ─── Docs ──────────────────────────────────────────────────────────────────
  list_documents: { category: 'search', icon: 'ncSearch', labelFn: () => 'Browsing pages' },
  get_document: {
    category: 'search',
    icon: 'ncSearch',
    labelFn: () => 'Opening page',
    descriptionFn: (b) => {
      const n = inp(b).document_name
      return n ? bold(n) : ''
    },
  },
  create_document: {
    category: 'create',
    icon: 'ncPlus',
    labelFn: () => 'Drafting new page',
    descriptionFn: (b) => {
      const n = inp(b).title
      return n ? bold(n) : ''
    },
  },
  update_document: {
    category: 'update',
    icon: 'ncEdit',
    labelFn: () => 'Rewriting page',
    descriptionFn: (b) => {
      const n = inp(b).document_name
      return n ? bold(n) : ''
    },
  },
  patch_document: {
    category: 'update',
    icon: 'ncEdit',
    labelFn: () => 'Refining content',
    descriptionFn: (b) => {
      const n = inp(b).document_name
      return n ? bold(n) : ''
    },
  },
  delete_document: {
    category: 'delete',
    icon: 'ncTrash2',
    labelFn: () => 'Removing page',
    descriptionFn: (b) => {
      const n = inp(b).document_name
      return n ? bold(n) : ''
    },
  },
  list_document_comments: {
    category: 'search',
    icon: 'ncSearch',
    labelFn: () => 'Checking discussion',
    descriptionFn: (b) => {
      const n = inp(b).document_name
      return n ? bold(n) : ''
    },
  },
  add_document_comment: {
    category: 'create',
    icon: 'ncPlus',
    labelFn: () => 'Leaving a note',
    descriptionFn: (b) => {
      const n = inp(b).document_name
      return n ? bold(n) : ''
    },
  },
  resolve_document_comment: {
    category: 'update',
    icon: 'ncEdit',
    labelFn: () => 'Closing discussion',
  },

  // ─── Sandbox ────────────────────────────────────────────────────────────────
  execute_code: {
    category: 'search',
    icon: 'ncSearch',
    labelFn: () => 'Analyzing files',
  },

  web_search: {
    category: 'web',
    icon: 'ncGlobe',
    labelFn: () => 'Searching the web',
    descriptionFn: (b) => {
      const q = inp(b).query || inp(b).q
      return q ? `"${esc(String(q))}"` : ''
    },
    sourcesFn: extractWebSources,
  },
  web_scrape: {
    category: 'web',
    icon: 'ncGlobe',
    labelFn: () => 'Reading page content',
    sourcesFn: extractWebSources,
  },

  open_table: {
    category: 'navigate',
    icon: 'ncNavigation',
    labelFn: () => 'Opening table',
    descriptionFn: (b) => {
      const n = inp(b).table_name
      return n ? bold(n) : ''
    },
  },
  open_view: {
    category: 'navigate',
    icon: 'ncNavigation',
    labelFn: () => 'Opening view',
    descriptionFn: (b) => {
      const n = inp(b).view_name || inp(b).title
      return n ? bold(n) : ''
    },
  },
  open_dashboard: {
    category: 'navigate',
    icon: 'ncNavigation',
    labelFn: () => 'Opening dashboard',
    descriptionFn: (b) => {
      const n = inp(b).dashboard_name || inp(b).title
      return n ? bold(n) : ''
    },
  },
}

function extractWebSources(blocks: ToolUseBlock[]): import('./thinkingTypes').WebSource[] {
  const sources: import('./thinkingTypes').WebSource[] = []
  for (const b of blocks) {
    const webResults = (b.metadata as any)?.webResults
    if (Array.isArray(webResults)) {
      for (const r of webResults) {
        if (r.url) sources.push({ url: r.url, title: r.title, favicon: r.favicon })
      }
    }
  }
  return sources
}

export function generateDescription(block: ToolUseBlock): string {
  try {
    return STEP_CONFIG[block.name]?.descriptionFn?.(block) ?? ''
  } catch {
    return ''
  }
}

export function extractSources(blocks: ToolUseBlock[]): import('./thinkingTypes').WebSource[] {
  try {
    const config = STEP_CONFIG[blocks[0]?.name]
    return config?.sourcesFn?.(blocks) ?? []
  } catch {
    return []
  }
}

export function extractMentions(blocks: ToolUseBlock[]): { tableName?: string; fieldBadges: FieldBadge[] } {
  try {
    const config = STEP_CONFIG[blocks[0]?.name]
    if (config?.mentionsFn) return config.mentionsFn(blocks)
    return { tableName: (blocks[0]?.input as any)?.table_name, fieldBadges: collectFieldBadgesFromBlocks(blocks) }
  } catch {
    return { fieldBadges: [] }
  }
}
