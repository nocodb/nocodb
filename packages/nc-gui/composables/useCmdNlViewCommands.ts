import type { EventHook, UseEventBusReturn } from '@vueuse/core'
import dayjs from 'dayjs'
import type { ColumnType, FilterType, TableType, ViewType } from 'nocodb-sdk'
import { PermissionEntity, PermissionKey, UITypes, ViewTypes } from 'nocodb-sdk'
import type { CmdChip, CmdCommand, CmdIcon, CmdSkeleton } from '~/lib/types'
import { useCmdNl } from '~/composables/useCmdNl'
import { useRelativeEditCommands } from '~/composables/useSetFieldCommands'
import { canonical, compileCond } from '~/utils/cmdNl/compile'
import type { CmdIR, CmdNlAssumption, CmdNlCmp, CondLeaf, FieldRef, Scalar } from '~/utils/cmdNl/ir'
import { CMD_NL_RATIO, CMD_NL_SHARE, condLeaves } from '~/utils/cmdNl/ir'
import { cmdNlDiagnose } from '~/utils/cmdNl/diagnose'
import type { CmdNlField, CmdNlSchema } from '~/utils/cmdNl/schema'
import { cmdNlField } from '~/utils/cmdNl/schema'
import { cmdNlSkeleton } from '~/utils/cmdNl/skeleton'
import type { CmdNlSuggestion } from '~/utils/cmdNl/suggest'
import { CMD_NL_CMP_BY_KIND, cmdNlSuggest, cmdNlValueTail, cmdNlValueTyped } from '~/utils/cmdNl/suggest'
import { cmdNlCountBucket, cmdNlLatencyBucket, cmdNlReadingTele } from '~/utils/cmdNl/telemetry'
import { getCmdNlTagger } from '~/utils/cmdNl/taggerScore'

/**
 * The view's natural-language rows in Cmd+K: every reading of the query from the NL parser, run by the
 * view's own executors (aggregate, filters, sorts, group-by, bulk update, insert), plus completions
 * while a field or value is half typed.
 */

export interface CmdNlViewContext {
  meta: Ref<TableType | undefined>
  view: Ref<ViewType | undefined>
  visibleFields: Ref<ColumnType[]>
  nestedFilters: Ref<FilterType[]>
  eventBus: UseEventBusReturn<SmartsheetStoreEvents, unknown>
  reloadViewDataHook: EventHook<unknown>
  isGrid: Ref<boolean>
  isGallery: Ref<boolean>
  isKanban: Ref<boolean>
  isSqlView: Ref<boolean>
  isLockedView: Ref<boolean>
  /** Interface pages have their own record grants; bulk edits and view config stay in the data view. */
  isInterfacePage: boolean
}

type Remote<T> = { at: number } & ({ status: 'loading' } | { status: 'done'; value: T } | { status: 'error'; message: string })

/** Server answers are reused for this long before a repeated query refetches them. */
const REMOTE_TTL = 30_000

/** Matching records a where-edit fetches and updates in one go. */
const WHERE_ROW_CAP = 1000

/** Loaded records used as value anchors and for value completion. */
const SAMPLE_ROWS = 200

const MAX_SUGGESTIONS = 6

/** Shown when the parser isn't sure: the top readings, Tab switching between them. */
const UNSURE_READINGS = 2

const CMP_TEXT: Partial<Record<CmdNlCmp, string>> = {
  eq: 'is',
  neq: 'is not',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  like: 'contains',
  nlike: "doesn't contain",
  blank: 'is empty',
  notblank: 'is not empty',
  checked: 'is checked',
  notchecked: 'is not checked',
  anyof: 'is any of',
  allof: 'has all of',
  nanyof: 'is none of',
  between: 'is between',
  within: 'is within',
}

/** "percent of annual revenue where industry is manufacturing": a share of the whole view. */
const SHARE_OF = /^\s*(?:what(?:'s|\s+is)\s+(?:the\s+)?)?(?:percent(?:age)?|%|share|proportion|fraction)\s+(?:of\s+)?(.+)$/i

const ICON_OF: Partial<Record<CmdIR['intent'], string>> = {
  stat: 'ncBarChart2',
  filter: 'filter',
  sort: 'sort',
  group: 'group',
  edit: 'ncEdit',
  create: 'plus',
}

export function useCmdNlViewCommands(ctx: CmdNlViewContext) {
  const { t } = useI18n()

  const { $api, $e } = useNuxtApp()

  const { user } = useGlobal()

  const { isUIAllowed, isDataReadOnly } = useRoles()

  const { isAllowed: isPermissionAllowed } = usePermissions()

  const { internalGet } = useInternalBatch()

  const { metas } = useMetas()

  const { isMysql, isPg } = useBase()

  const { showWarningModal } = useNcConfirmModal()

  const { schemaFor, parse: parseRaw, warm, historyFor, remember, historyVersion } = useCmdNl()

  const { cmdK } = useCommand()

  /** Readings with the user's past picks on this table as a (capped) ranking hint. */
  const parse = (query: string, nlSchema: CmdNlSchema, rows?: Record<string, unknown>[]) =>
    parseRaw(query, nlSchema, rows, {
      history: historyFor(ctx.meta.value?.id),
      key: String(historyVersion.value),
    })

  const relativeEdit = useRelativeEditCommands()

  const aggregates = reactive(new Map<string, Remote<unknown>>())

  const whereRows = reactive(new Map<string, Remote<{ rows: Record<string, any>[]; total: number }>>())

  const valueLookups = reactive(new Map<string, Remote<string[]>>())

  const samples = shallowReactive(new Map<string, Record<string, unknown>[]>())

  const sampleRequested = new Set<string>()

  const { copy } = useCopy()

  const pending = shallowRef<{ key: string; load: () => Promise<void> }[]>([])

  // Requests are queued from the provider's read and sent after a pause in typing.
  watchDebounced(
    pending,
    (jobs) => {
      pending.value = []
      for (const job of jobs) job.load()
    },
    { debounce: 250 },
  )

  function enqueue(key: string, entry: Remote<unknown> | undefined, load: () => Promise<void>) {
    if (entry && (entry.status === 'loading' || Date.now() - entry.at < REMOTE_TTL)) return
    if (pending.value.some((job) => job.key === key)) return
    queueMicrotask(() => (pending.value = [...pending.value, { key, load }]))
  }

  const schema = computed(() => schemaFor(ctx.meta.value))

  const columnOf = (id: string) => ctx.meta.value?.columns?.find((column) => column.id === id)

  const isVisible = (id: string) => ctx.visibleFields.value.some((field) => field.id === id)

  /** Only grid views aggregate server-side with their own filters; other views send theirs explicitly. */
  const aggregatesByView = computed(() => ctx.isGrid.value)

  /** Stats need records: every data view but SQL views and forms (kanban, gallery, calendar aggregate table-wide). */
  const canStat = computed(() => !ctx.isSqlView.value && !!ctx.view.value && ctx.view.value.type !== ViewTypes.FORM)

  /** The view type a reading ran on, for telemetry. */
  const surface = computed(() => {
    switch (ctx.view.value?.type) {
      case ViewTypes.GRID:
        return 'grid'
      case ViewTypes.KANBAN:
        return 'kanban'
      case ViewTypes.GALLERY:
        return 'gallery'
      case ViewTypes.CALENDAR:
        return 'calendar'
      case ViewTypes.FORM:
        return 'form'
      default:
        return 'other'
    }
  })

  /** Toolbar filters that are complete enough to send (a half-made one has no comparison yet). */
  const toolbarFilters = () => ctx.nestedFilters.value.filter((f) => f.is_group || (f.fk_column_id && f.comparison_op))

  /** A view's own filters apply server-side; unsaved toolbar ones (no filter-sync) are sent along, as the footer does. */
  function viewFilters(extra: FilterType[]): FilterType[] {
    const own = toolbarFilters()
    // Kanban, gallery and calendar aggregate table-wide, so their saved filters travel with the request.
    const send = own.length && (!aggregatesByView.value || !isUIAllowed('filterSync'))
    return [...(send ? [{ is_group: true, children: own, logical_op: 'and' } as FilterType] : []), ...extra]
  }

  function sampleRows(): Record<string, unknown>[] | undefined {
    const table = ctx.meta.value
    const viewId = ctx.view.value?.id
    if (!table?.id || !viewId || ctx.isSqlView.value) return
    const rows = samples.get(viewId)
    if (rows || sampleRequested.has(viewId)) return rows
    sampleRequested.add(viewId)
    // Not from inside the provider's read.
    queueMicrotask(() =>
      $api.dbViewRow
        .list('noco', table.base_id!, table.id!, viewId, { limit: SAMPLE_ROWS, offset: 0 })
        .then((data) => samples.set(viewId, (data.list ?? []) as Record<string, unknown>[]))
        .catch(() => sampleRequested.delete(viewId)),
    )
  }

  // On open, in idle time: lazy chunks, the sample rows, and a warm-up pass, so the first keystrokes stay cheap.
  watch(
    [cmdK, schema, () => samples.get(ctx.view.value?.id ?? '')],
    ([open]) => {
      if (!open || !schema.value) return
      const rows = sampleRows()
      const run = () => warm(schema.value, rows?.length ? rows : undefined)
      if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 500 })
      else setTimeout(run, 50)
    },
    { immediate: true },
  )

  /* --------------------------------------------- values ---------------------------------------------- */

  function relativeDay(value: Extract<Scalar, { relative: string }>) {
    const now = dayjs()
    const n = value.n ?? 0
    switch (value.relative) {
      case 'tomorrow':
        return now.add(1, 'day')
      case 'yesterday':
        return now.subtract(1, 'day')
      case 'oneWeekAgo':
        return now.subtract(1, 'week')
      case 'oneWeekFromNow':
        return now.add(1, 'week')
      case 'oneMonthAgo':
        return now.subtract(1, 'month')
      case 'oneMonthFromNow':
        return now.add(1, 'month')
      case 'daysAgo':
        return now.subtract(n, 'day')
      case 'daysFromNow':
        return now.add(n, 'day')
      default:
        return now
    }
  }

  /** A typed value as the column's cells store it, or undefined when it can't be stored there. */
  function cellValue(column: ColumnType, value: Scalar | Scalar[]): unknown {
    if (Array.isArray(value)) {
      const parts = value.map((part) => cellValue(column, part))
      return parts.every((part) => part !== undefined) ? parts.join(',') : undefined
    }
    if (value === null || typeof value !== 'object') return value
    if ('me' in value) return user.value?.email ?? user.value?.id
    if ('member' in value) {
      const member = schema.value?.fields.find((f) => f.id === column.id)?.members?.find((m) => m.id === value.member)
      return member?.email ?? value.member
    }
    if ('range' in value) return
    const day = 'date' in value ? dayjs(value.date) : relativeDay(value)
    if (!day.isValid()) return
    if (column.uidt === UITypes.DateTime) return day.utc().format('YYYY-MM-DD HH:mm:ssZ')
    return day.format('YYYY-MM-DD')
  }

  function scalarText(value: Scalar | Scalar[] | undefined, field?: CmdNlField): string {
    if (value === undefined) return ''
    if (Array.isArray(value)) return value.map((v) => scalarText(v, field)).join(', ')
    if (value === null) return t('labels.commandPalette.nl.empty')
    if (typeof value !== 'object') return typeof value === 'number' ? value.toLocaleString() : String(value)
    if ('me' in value) return t('labels.commandPalette.data.me')
    if ('member' in value) return field?.members?.find((m) => m.id === value.member)?.name ?? value.member
    if ('date' in value) return value.date
    if ('range' in value) return `${value.range[0]} – ${value.range[1]}`
    return relativeText(value)
  }

  /** "pastNumberOfDays", n 30 → "past 30 days"; "oneWeekAgo" → "one week ago". */
  function relativeText(value: Extract<Scalar, { relative: string }>) {
    const n = value.n
    if (n !== undefined && value.relative.endsWith('NumberOfDays')) {
      return t(value.relative.startsWith('next') ? 'labels.commandPalette.nl.nextDays' : 'labels.commandPalette.nl.pastDays', {
        n,
      }).toLowerCase()
    }
    if (n !== undefined && /^days(Ago|FromNow)$/.test(value.relative)) {
      return `${n} ${value.relative === 'daysAgo' ? 'days ago' : 'days from now'}`
    }
    return value.relative.replace(/([A-Z])/g, ' $1').toLowerCase()
  }

  /* --------------------------------------------- chips ----------------------------------------------- */

  /** Where in the query a reading found something: the span the parser linked to `ref`, else the text itself. */
  function spanOf(ir: CmdIR, query: string, tag: string, ref?: string, text?: string) {
    const span = ir.meta.spans.find((s) => s.tag === tag && (!ref || s.ref === ref))
    if (span) return { start: span.start, end: span.end }
    if (!text) return
    const at = query.toLowerCase().indexOf(text.toLowerCase())
    return at < 0 ? undefined : { start: at, end: at + text.length }
  }

  const rewrite = (query: string, at: { start: number; end: number }, text: string) =>
    `${query.slice(0, at.start)}${text}${query.slice(at.end)}`

  function fieldChip(ir: CmdIR, query: string, ref: FieldRef): CmdChip | undefined {
    const field = schema.value && cmdNlField(schema.value, ref.id)
    if (!field) return
    const at = spanOf(ir, query, 'field', field.id)
    const column = columnOf(field.id)
    return {
      text: field.title,
      kind: 'field',
      icon: column ? { type: 'field', column } : undefined,
      label: t('labels.commandPalette.nl.changeField'),
      swaps: at
        ? schema
            .value!.fields.filter((f) => f.kind === field.kind && f.id !== field.id)
            .slice(0, 12)
            .map((f) => {
              const c = columnOf(f.id)
              return {
                label: f.title,
                query: rewrite(query, at, f.title.toLowerCase()),
                icon: c ? { type: 'field', column: c } : undefined,
              }
            })
        : [],
    }
  }

  /** Values a field can take, for swapping and completion: options, members, or loaded text values. */
  function knownValues(field: CmdNlField): { label: string; text: string; icon?: CmdIcon }[] {
    if (field.options?.length) return field.options.map((option) => ({ label: option, text: option }))
    if (field.members?.length) {
      return field.members.map((member) => ({ label: member.name, text: member.name || member.email || member.id }))
    }
    if (field.kind !== 'text') return []
    const values = new Set<string>()
    for (const row of sampleRows() ?? []) {
      const value = row[field.title]
      if (typeof value === 'string' && value.trim() && value.length <= 60) values.add(value.trim())
      if (values.size >= 50) break
    }
    return [...values].map((value) => ({ label: value, text: value }))
  }

  function valueChip(ir: CmdIR, query: string, leaf: CondLeaf): CmdChip | undefined {
    const field = schema.value && cmdNlField(schema.value, leaf.field.id)
    if (!field || leaf.value === undefined) return
    const text = scalarText(leaf.value, field)
    const ref = typeof leaf.value === 'object' && leaf.value && 'member' in leaf.value ? leaf.value.member : String(leaf.value)
    const at = spanOf(ir, query, 'value', ref, typeof leaf.value === 'string' ? leaf.value : undefined)
    return {
      text,
      kind: 'value',
      label: t('labels.commandPalette.nl.changeValue'),
      swaps: at
        ? knownValues(field)
            .filter((value) => value.text.toLowerCase() !== text.toLowerCase())
            .slice(0, 20)
            .map((value) => ({ label: value.label, query: rewrite(query, at, value.text) }))
        : [],
    }
  }

  /** Comparator words the grammar reads, for writing an assumed threshold out explicitly. */
  const EXPLICIT_CMP: Partial<Record<CmdNlCmp, string>> = { gte: '>=', lte: '<=', gt: '>', lt: '<', eq: 'is' }

  const WINDOW_DAYS = [7, 14, 30, 90]

  const AGG_WORDS = ['sum', 'average', 'min', 'max', 'count']

  /** A rewrite reads explicitly when its top reading needs no assumption. */
  function readsExplicitly(text: string) {
    const nlSchema = schema.value
    if (!nlSchema) return false
    const [ir] = parse(text, nlSchema, sampleRows())
    return !!ir && !ir.meta.assumptions?.length
  }

  /** Choices that replace an assumed word with explicit ones ("recent" → "in the past 7 days"). */
  function assumptionSwaps(ir: CmdIR, query: string, assumption: CmdNlAssumption): NonNullable<CmdChip['swaps']> {
    const at = { start: assumption.span[0], end: assumption.span[1] }
    const field = assumption.ref && schema.value ? cmdNlField(schema.value, assumption.ref) : undefined
    const leaf = condLeaves(ir.where).find((l) => l.field.id === assumption.ref)
    switch (assumption.kind) {
      case 'date-window': {
        const value = leaf?.value
        const relative = value && typeof value === 'object' && 'relative' in value ? value : undefined
        const dir = relative?.relative.startsWith('next') ? 'next' : 'past'
        const window = (n: number) => `in the ${dir} ${n} days`
        // Name the field too when the other words don't ("recent deals" with two date fields).
        const named = field && !readsExplicitly(rewrite(query, at, window(relative?.n ?? 30)))
        return WINDOW_DAYS.map((n) => ({
          label: t(dir === 'next' ? 'labels.commandPalette.nl.nextDays' : 'labels.commandPalette.nl.pastDays', { n }),
          query: rewrite(query, at, named ? `${field.title.toLowerCase()} ${window(n)}` : window(n)),
        }))
      }
      case 'threshold':
      case 'priority': {
        if (!field || !leaf) return []
        const op = EXPLICIT_CMP[leaf.cmp]
        if (typeof leaf.value !== 'number' || !op) {
          const text = `${field.title.toLowerCase()} is ${scalarText(leaf.value, field)}`
          return [{ label: `${field.title} ${scalarText(leaf.value, field)}`, query: rewrite(query, at, text) }]
        }
        const v = leaf.value
        const values = [...new Set([v, Math.round(v / 2), v * 2])].filter((n) => Number.isFinite(n))
        return values.map((n) => ({
          label: `${field.title} ${op} ${n.toLocaleString()}`,
          query: rewrite(query, at, `${field.title.toLowerCase()} ${op} ${n}`),
        }))
      }
      case 'agg': {
        const words = query.slice(at.start, at.end)
        const current = ir.aggs?.[0]?.fn === 'avg' ? 'average' : ir.aggs?.[0]?.fn
        return AGG_WORDS.filter((word) => word !== current).map((word) => ({
          label: `${word.charAt(0).toUpperCase()}${word.slice(1)} of ${field?.title ?? words}`,
          query: rewrite(query, at, `${word} of ${words}`),
        }))
      }
      case 'field':
        if (!field || !schema.value) return []
        return schema.value.fields
          .filter((f) => f.kind === field.kind && f.id !== field.id)
          .slice(0, 12)
          .map((f) => ({ label: f.title, query: rewrite(query, at, f.title.toLowerCase()) }))
      default:
        return []
    }
  }

  /** Guesses the reading made, as dotted chips; picking a choice writes the guess out explicitly. */
  function assumedChips(ir: CmdIR, query: string): CmdChip[] {
    return (ir.meta.assumptions ?? []).map((assumption) => ({
      key: `assumed:${assumption.span[0]}`,
      kind: 'assumed',
      text: query.slice(assumption.span[0], assumption.span[1]) || assumption.text,
      tooltip: assumption.text,
      label: t('labels.commandPalette.nl.makeExplicit'),
      swaps: assumptionSwaps(ir, query, assumption),
    }))
  }

  function chipsOf(ir: CmdIR, query: string): CmdChip[] {
    const chips: CmdChip[] = assumedChips(ir, query)
    const push = (chip?: CmdChip) => chip && chips.push(chip)
    for (const agg of ir.aggs ?? []) {
      chips.push({
        text:
          agg.fn === CMD_NL_SHARE
            ? t('labels.commandPalette.nl.share')
            : agg.fn === CMD_NL_RATIO
            ? t('labels.commandPalette.nl.ratio')
            : t(`aggregation_type.${agg.fn}`),
        kind: 'agg',
      })
      if (agg.field) push(fieldChip(ir, query, agg.field))
    }
    for (const edit of ir.edits ?? []) {
      chips.push({ text: t(`labels.commandPalette.nl.edit.${edit.op.kind}`), kind: 'verb' })
      if (edit.field) push(fieldChip(ir, query, edit.field))
    }
    for (const field of ir.groupBy ?? []) push(fieldChip(ir, query, field))
    for (const order of ir.orderBy ?? []) if (order.field !== 'agg0') push(fieldChip(ir, query, order.field))
    for (const leaf of condLeaves(ir.where)) {
      push(fieldChip(ir, query, leaf.field))
      chips.push(cmpChip(ir, query, leaf))
      push(valueChip(ir, query, leaf))
    }
    return chips
  }

  /** Comparators that take no value: swapping to one drops the typed value too. */
  const VALUELESS_PHRASES = new Set(['is empty', 'is not empty', 'is checked', 'is not checked', 'is me'])

  /** The comparator chip; its alternatives are the ones valid for the field's type, rewritten in place. */
  function cmpChip(ir: CmdIR, query: string, leaf: CondLeaf): CmdChip {
    const chip: CmdChip = { text: CMP_TEXT[leaf.cmp] ?? leaf.cmp, kind: 'cmp' }
    const field = schema.value && cmdNlField(schema.value, leaf.field.id)
    const fieldAt = spanOf(ir, query, 'field', leaf.field.id)
    if (!field || !fieldAt) return chip
    const valueRef =
      typeof leaf.value === 'object' && leaf.value && 'member' in leaf.value ? leaf.value.member : String(leaf.value ?? '')
    const valueAt =
      leaf.value === undefined
        ? undefined
        : spanOf(ir, query, 'value', valueRef, typeof leaf.value === 'string' ? leaf.value : undefined)
    // The comparator the reading used: the first one after this field (and before its value).
    const at = ir.meta.spans.find((s) => s.tag === 'cmp' && s.start >= fieldAt.end && (!valueAt || s.end <= valueAt.start))
    if (!at) return chip
    const typed = query.slice(at.start, at.end).toLowerCase()
    return {
      ...chip,
      label: t('labels.commandPalette.nl.changeOperator'),
      swaps: CMD_NL_CMP_BY_KIND[field.kind]
        .filter((phrase) => phrase !== typed)
        .map((phrase) => {
          if (VALUELESS_PHRASES.has(phrase)) {
            return { label: phrase, query: rewrite(query, { start: at.start, end: valueAt?.end ?? at.end }, phrase) }
          }
          // From a valueless comparator ("is empty") to one that needs a value: leave room to type it.
          return { label: phrase, query: rewrite(query, at, valueAt ? phrase : `${phrase} `) }
        }),
    }
  }

  /** What each recognised word of a half-typed query stands for, before any reading exists. */
  function skeletonOf(query: string): CmdSkeleton | undefined {
    const nlSchema = schema.value
    if (!ctx.view.value?.id || !nlSchema || !query.trim()) return
    const rows = sampleRows()
    const skeleton = cmdNlSkeleton(query, nlSchema, { rows: rows?.length ? rows : undefined })
    const fieldIcon = (id?: string): CmdIcon | undefined => {
      const column = id ? columnOf(id) : undefined
      return column ? { type: 'field', column } : undefined
    }
    // "sum of" → "Sum": the aggregation, not its joining word.
    const aggText = (text: string) => {
      const head = text.replace(/\s+of$/i, '')
      return head.charAt(0).toUpperCase() + head.slice(1)
    }
    const chips = skeleton.chips.map((chip): CmdChip => {
      const key = `${chip.kind}:${chip.from}`
      switch (chip.kind) {
        case 'share':
          return { key, kind: 'agg', text: t('labels.commandPalette.nl.share') }
        case 'agg':
          return { key, kind: 'agg', text: aggText(chip.text) }
        case 'field':
          return { key, kind: 'field', text: chip.text, icon: fieldIcon(chip.ref) }
        case 'cmp':
          return { key, kind: 'cmp', text: CMP_TEXT[chip.ref as CmdNlCmp] ?? chip.text }
        case 'value':
        case 'num':
        case 'date':
          return { key, kind: 'value', text: chip.text }
        case 'noun':
        case 'verb':
          return { key, kind: chip.kind, text: chip.text }
        default:
          return { key, kind: 'text', text: chip.text }
      }
    })
    const ghost = skeleton.ghost
    return {
      chips,
      ghost: ghost && {
        text: ghost.title,
        icon: fieldIcon(ghost.fieldId),
        complete: `${query.slice(0, ghost.from)}${ghost.title} `,
      },
    }
  }

  /* --------------------------------------------- executors ------------------------------------------- */

  /** The server's figure; non-grid views (the endpoint is grid-only) aggregate the table with their filters sent. */
  async function aggregate(column: ColumnType, fn: string, filters: FilterType[]) {
    const table = ctx.meta.value!
    const data = await internalGet<Record<string, unknown>>(table.fk_workspace_id!, table.base_id!, {
      operation: 'dataAggregate',
      tableId: table.id!,
      ...(aggregatesByView.value ? { viewId: ctx.view.value!.id! } : {}),
      baseId: table.base_id!,
      aggregation: JSON.stringify([{ field: column.id, type: fn }]),
      ...(filters.length ? { filterArrJson: JSON.stringify(filters) } : {}),
    })
    return data?.[column.title!]
  }

  function formatAggregate(column: ColumnType, fn: string, raw: unknown) {
    if (fn === 'count') return Number(raw ?? 0).toLocaleString('en-US')
    const value = getFormattedAggrationValue(fn, raw, column, [], {
      col: column,
      meta: ctx.meta.value as TableType,
      metas: metas.value,
      isMysql,
      isPg,
    })
    return value === undefined || value === null ? '–' : String(value)
  }

  /** A summary row: the server's figure for the view (and a condition), copied on Enter. */
  function statRow(row: CmdCommand, ir: CmdIR, share: boolean): CmdCommand {
    const table = ctx.meta.value!
    const agg = ir.aggs?.[0]
    const column = agg?.field ? columnOf(agg.field.id) : table.columns?.find((c) => c.pv) ?? table.columns?.[0]
    const fn = share && agg?.fn === 'count' ? 'count' : agg?.fn ?? 'count'
    if (!column) return { ...row, disabled: true }
    if (agg?.field && !isVisible(column.id!)) {
      return { ...row, hint: t('labels.commandPalette.data.statHidden', { field: column.title }), disabled: true, error: true }
    }
    if (ir.groupBy?.length) {
      return { ...row, hint: t('labels.commandPalette.nl.groupedStat'), disabled: true }
    }
    const compiled = ir.where ? compileCond(ir.where, schema.value!) : { filters: [], errors: [] }
    if (compiled.errors.length) return { ...row, hint: compiled.errors[0], disabled: true, error: true }
    if (share && !ir.where) return { ...row, hint: t('labels.commandPalette.nl.shareNeedsCondition'), disabled: true }

    const key = JSON.stringify([ctx.view.value?.id, fn, column.id, compiled.filters, share])
    const entry = aggregates.get(key)
    enqueue(key, entry, async () => {
      aggregates.set(key, { status: 'loading', at: Date.now() })
      try {
        const part = await aggregate(column, fn, viewFilters(compiled.filters))
        if (!share) {
          aggregates.set(key, { status: 'done', value: formatAggregate(column, fn, part), at: Date.now() })
          return
        }
        const whole = await aggregate(column, fn, viewFilters([]))
        const ratio = Number(whole) ? (Number(part) / Number(whole)) * 100 : NaN
        const percent = Number.isFinite(ratio) ? `${ratio.toLocaleString('en-US', { maximumFractionDigits: 1 })}%` : '–'
        // "12.4% · $1.2M of $9.7M": the share, then the two figures it comes from.
        aggregates.set(key, {
          status: 'done',
          value: { percent, of: `${formatAggregate(column, fn, part)} of ${formatAggregate(column, fn, whole)}` },
          at: Date.now(),
        })
      } catch (e) {
        aggregates.set(key, { status: 'error', message: await extractSdkResponseErrorMsg(e as Error), at: Date.now() })
      }
    })
    if (!entry || entry.status === 'loading') return { ...row, loading: true, disabled: true }
    if (entry.status === 'error') return { ...row, hint: entry.message, disabled: true, error: true }
    const result = entry.value as string | { percent: string; of: string }
    const value = typeof result === 'string' ? result : result.percent
    return {
      ...row,
      value: typeof result === 'string' ? result : `${result.percent} · ${result.of}`,
      feedback: t('labels.commandPalette.copiedValue', { value }),
      run: () => copy(value),
    }
  }

  /** Group values a per-group share is split by: the options, else the values in loaded rows. */
  const GROUP_SHARE_MAX = 12

  /** "share of revenue by industry": each group's sum (or count) over the view's, listed on Enter. */
  function groupShareRow(row: CmdCommand, ir: CmdIR): CmdCommand {
    const table = ctx.meta.value!
    const agg = ir.aggs![0]!
    const groupRef = ir.groupBy![0]!
    const group = columnOf(groupRef.id)
    const groupField = schema.value && cmdNlField(schema.value, groupRef.id)
    const fn = agg.base === 'count' ? 'count' : 'sum'
    const column = fn === 'sum' && agg.field ? columnOf(agg.field.id) : table.columns?.find((c) => c.pv) ?? table.columns?.[0]
    if (!group || !groupField || !column) return { ...row, disabled: true }
    if (fn === 'sum' && !isVisible(column.id!)) {
      return { ...row, hint: t('labels.commandPalette.data.statHidden', { field: column.title }), disabled: true, error: true }
    }
    const values = knownValues(groupField)
      .map((value) => value.text)
      .slice(0, GROUP_SHARE_MAX)
    if (!values.length) return { ...row, hint: t('labels.commandPalette.nl.groupedStat'), disabled: true }

    const key = JSON.stringify([ctx.view.value?.id, 'group-share', fn, column.id, group.id, values])
    const entry = aggregates.get(key)
    enqueue(key, entry, async () => {
      aggregates.set(key, { status: 'loading', at: Date.now() })
      try {
        const whole = Number(await aggregate(column, fn, viewFilters([])))
        const op = groupField.kind === 'multiselect' || groupField.kind === 'user' ? 'anyof' : 'eq'
        const parts = await Promise.all(
          values.map(async (value) => {
            const filter = { fk_column_id: group.id, comparison_op: op, value, logical_op: 'and' } as FilterType
            const part = await aggregate(column, fn, viewFilters([filter]))
            return { label: value, part, ratio: whole ? (Number(part) / whole) * 100 : NaN }
          }),
        )
        const groups = parts
          .filter((p) => Number(p.part))
          .sort((a, b) => b.ratio - a.ratio)
          .map((p) => ({
            label: p.label,
            percent: Number.isFinite(p.ratio) ? `${p.ratio.toLocaleString('en-US', { maximumFractionDigits: 1 })}%` : '–',
            of: formatAggregate(column, fn, p.part),
          }))
        aggregates.set(key, { status: 'done', value: groups, at: Date.now() })
      } catch (e) {
        aggregates.set(key, { status: 'error', message: await extractSdkResponseErrorMsg(e as Error), at: Date.now() })
      }
    })
    if (!entry || entry.status === 'loading') return { ...row, loading: true, disabled: true }
    if (entry.status === 'error') return { ...row, hint: entry.message, disabled: true, error: true }
    const groups = entry.value as { label: string; percent: string; of: string }[]
    if (!groups.length) return { ...row, hint: t('labels.commandPalette.where.noMatch'), disabled: true }
    return {
      ...row,
      value: `${groups[0]!.label} ${groups[0]!.percent}`,
      groupChildren: false,
      children: () =>
        groups.map((g, i) => ({
          id: `${row.id}:${i}`,
          title: g.label,
          value: `${g.percent} · ${g.of}`,
          feedback: t('labels.commandPalette.copiedValue', { value: g.percent }),
          run: () => copy(g.percent),
        })),
    }
  }

  /** "ratio of won to lost deals": base over (view ∧ where ∧ num) ÷ base over (view ∧ where ∧ den); Enter copies it. */
  function ratioRow(row: CmdCommand, ir: CmdIR): CmdCommand {
    const table = ctx.meta.value!
    const agg = ir.aggs![0]!
    const fn = agg.base === 'sum' ? 'sum' : 'count'
    const column = fn === 'sum' && agg.field ? columnOf(agg.field.id) : table.columns?.find((c) => c.pv) ?? table.columns?.[0]
    if (!column || !agg.num || !agg.den) return { ...row, disabled: true }
    if (fn === 'sum' && !isVisible(column.id!)) {
      return { ...row, hint: t('labels.commandPalette.data.statHidden', { field: column.title }), disabled: true, error: true }
    }
    const nlSchema = schema.value!
    const where = ir.where ? compileCond(ir.where, nlSchema) : { filters: [], errors: [] }
    const num = compileCond(agg.num, nlSchema)
    const den = compileCond(agg.den, nlSchema)
    const errors = [...where.errors, ...num.errors, ...den.errors]
    if (errors.length) return { ...row, hint: errors[0], disabled: true, error: true }

    const key = JSON.stringify([ctx.view.value?.id, 'ratio', fn, column.id, where.filters, num.filters, den.filters])
    const entry = aggregates.get(key)
    enqueue(key, entry, async () => {
      aggregates.set(key, { status: 'loading', at: Date.now() })
      try {
        const [top, bottom] = await Promise.all([
          aggregate(column, fn, viewFilters([...where.filters, ...num.filters])),
          aggregate(column, fn, viewFilters([...where.filters, ...den.filters])),
        ])
        const ratio = Number(bottom) ? Number(top) / Number(bottom) : NaN
        const text = Number.isFinite(ratio) ? ratio.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '–'
        aggregates.set(key, {
          status: 'done',
          value: { ratio: text, of: `${formatAggregate(column, fn, top)} vs ${formatAggregate(column, fn, bottom)}` },
          at: Date.now(),
        })
      } catch (e) {
        aggregates.set(key, { status: 'error', message: await extractSdkResponseErrorMsg(e as Error), at: Date.now() })
      }
    })
    if (!entry || entry.status === 'loading') return { ...row, loading: true, disabled: true }
    if (entry.status === 'error') return { ...row, hint: entry.message, disabled: true, error: true }
    const result = entry.value as { ratio: string; of: string }
    return {
      ...row,
      value: `${result.ratio} : 1 · ${result.of}`,
      feedback: t('labels.commandPalette.copiedValue', { value: result.ratio }),
      run: () => copy(result.ratio),
    }
  }

  const canConfigure = (sync: 'filterSync' | 'sortSync') => isUIAllowed(sync) && !ctx.isLockedView.value && !ctx.isInterfacePage

  async function createFilters(filters: FilterType[], parentId?: string) {
    const table = ctx.meta.value!
    for (const { children, ...filter } of filters) {
      const saved = (await $api.internal.postOperation(
        table.fk_workspace_id!,
        table.base_id!,
        { operation: 'filterCreate', viewId: ctx.view.value!.id! },
        { ...filter, ...(parentId ? { fk_parent_id: parentId } : {}) },
      )) as FilterType
      if (filter.is_group && children?.length) await createFilters(children, saved.id)
    }
  }

  function filterRow(row: CmdCommand, ir: CmdIR): CmdCommand {
    if (!ir.where) return { ...row, disabled: true }
    if (!canConfigure('filterSync')) return { ...row, hint: t('labels.commandPalette.nl.cannotFilter'), disabled: true }
    const compiled = compileCond(ir.where, schema.value!)
    if (compiled.errors.length) return { ...row, hint: compiled.errors[0], disabled: true, error: true }
    // How many records the filter keeps, as suggestion rows show; Enter still adds the filter.
    const counted = canStat.value ? statRow({ ...row }, { ...ir, intent: 'stat', aggs: [{ fn: 'count' }] }, false) : undefined
    const count = counted?.value ? Number(counted.value.replace(/,/g, '')) : undefined
    return {
      ...row,
      ...(count !== undefined && Number.isFinite(count)
        ? { value: t('labels.commandPalette.where.count', { count }, count) }
        : {}),
      feedback: t('labels.commandPalette.nl.filtered'),
      run: async () => {
        await createFilters(compiled.filters)
        ctx.eventBus.emit(SmartsheetStoreEvents.FILTER_RELOAD)
        ctx.reloadViewDataHook.trigger()
      },
    }
  }

  function sortRow(row: CmdCommand, ir: CmdIR): CmdCommand {
    const orders = (ir.orderBy ?? []).flatMap((o) => (o.field === 'agg0' ? [] : [{ column: columnOf(o.field.id), dir: o.dir }]))
    if (!orders.length || orders.some((o) => !o.column)) return { ...row, disabled: true }
    if (!canConfigure('sortSync') || (ir.where && !canConfigure('filterSync'))) {
      return { ...row, hint: t('labels.commandPalette.nl.cannotSort'), disabled: true }
    }
    const compiled = ir.where ? compileCond(ir.where, schema.value!) : undefined
    const table = ctx.meta.value!
    return {
      ...row,
      hint: ir.limit ? t('labels.commandPalette.nl.limitIgnored', { count: ir.limit }) : row.hint,
      feedback: t('labels.commandPalette.nl.sorted'),
      run: async () => {
        if (compiled?.filters.length) await createFilters(compiled.filters)
        for (const order of orders) {
          await $api.internal.postOperation(
            table.fk_workspace_id!,
            table.base_id!,
            { operation: 'sortCreate', viewId: ctx.view.value!.id! },
            { fk_column_id: order.column!.id, direction: order.dir },
          )
        }
        ctx.eventBus.emit(SmartsheetStoreEvents.SORT_RELOAD)
        if (compiled?.filters.length) ctx.eventBus.emit(SmartsheetStoreEvents.FILTER_RELOAD)
        ctx.reloadViewDataHook.trigger()
      },
    }
  }

  function groupRow(row: CmdCommand, ir: CmdIR): CmdCommand {
    const columns = (ir.groupBy ?? []).map((ref) => columnOf(ref.id))
    if (!ctx.isGrid.value || !columns.length || columns.some((c) => !c) || ctx.isLockedView.value) {
      return { ...row, disabled: true }
    }
    return {
      ...row,
      run: () => {
        for (const column of columns) ctx.eventBus.emit(SmartsheetStoreEvents.GROUP_BY_ADD, { column })
      },
    }
  }

  function loadWhere(key: string, filters: FilterType[]) {
    const table = ctx.meta.value!
    const viewId = ctx.view.value!.id!
    return async () => {
      whereRows.set(key, { status: 'loading', at: Date.now() })
      try {
        const data = await $api.dbViewRow.list('noco', table.base_id!, table.id!, viewId, {
          filterArrJson: JSON.stringify(viewFilters(filters)),
          limit: WHERE_ROW_CAP,
          offset: 0,
        })
        const rows = (data.list ?? []) as Record<string, any>[]
        whereRows.set(key, { status: 'done', value: { rows, total: data.pageInfo?.totalRows ?? rows.length }, at: Date.now() })
      } catch (e) {
        whereRows.set(key, { status: 'error', message: await extractSdkResponseErrorMsg(e as Error), at: Date.now() })
      }
    }
  }

  /** One bulk update for the records whose value changes; the palette has closed, so errors toast as bulk saves do. */
  async function saveWhere(key: string, rows: Record<string, any>[], column: ColumnType, next: (prev: unknown) => unknown) {
    const table = ctx.meta.value!
    const title = column.title!
    const updates = rows.flatMap((row) => {
      const prev = row[title]
      const value = next(prev)
      if (value === undefined || JSON.stringify(value ?? null) === JSON.stringify(prev ?? null)) return []
      return [{ ...rowPkData(row, table.columns as ColumnType[]), [title]: value }]
    })
    if (!updates.length) return
    const tele = { count: cmdNlCountBucket(updates.length), uidt: column.uidt }
    try {
      await $api.dbTableRow.bulkUpdate('noco', table.base_id!, table.id!, updates, { typecast: 'true' })
    } catch (e) {
      $e('a:command-palette:where-edit:error', tele)
      message.error(await extractSdkResponseErrorMsg(e as Error))
      return
    }
    $e('a:command-palette:where-edit:success', tele)
    whereRows.delete(key)
    ctx.reloadViewDataHook.trigger()
  }

  /** "set stage won where amount > 1000": the matching records, previewed, confirmed and bulk-updated. */
  function whereEditRow(row: CmdCommand, ir: CmdIR): CmdCommand {
    const table = ctx.meta.value!
    const edit = ir.edits?.[0]
    const column = edit?.field ? columnOf(edit.field.id) : undefined
    if (!ctx.isGrid.value || !ir.where || !edit || !column) return { ...row, disabled: true }
    if (
      !isUIAllowed('dataEdit') ||
      isDataReadOnly.value ||
      table.synced ||
      ctx.isInterfacePage ||
      !relativeEdit.isSettable(column)
    ) {
      return { ...row, hint: t('labels.commandPalette.nl.cannotEdit'), disabled: true }
    }
    if (!isVisible(column.id!))
      return { ...row, hint: t('labels.commandPalette.where.hidden', { field: column.title }), disabled: true }
    if (edit.op.kind === 'fill') return { ...row, hint: t('labels.commandPalette.nl.fillNeedsRange'), disabled: true }

    const op = edit.op
    let next: (prev: unknown) => unknown
    if (op.kind === 'relative') {
      if (!relativeEdit.accepts(op.edit, column, table)) {
        return { ...row, hint: t('labels.commandPalette.relative.invalid'), disabled: true, error: true }
      }
      next = (prev) => relativeEdit.nextValue(op.edit, column, prev, table)
    } else if (op.kind === 'clear') {
      next = () => null
    } else {
      const value = cellValue(column, op.value)
      if (value === undefined) {
        return {
          ...row,
          hint: t('labels.commandPalette.where.invalidValue', { value: scalarText(op.value), field: column.title }),
          disabled: true,
          error: true,
        }
      }
      next = () => value
    }

    const compiled = compileCond(ir.where, schema.value!)
    if (compiled.errors.length) return { ...row, hint: compiled.errors[0], disabled: true, error: true }
    const key = JSON.stringify([ctx.view.value?.id, compiled.filters])
    const entry = whereRows.get(key)
    enqueue(key, entry, loadWhere(key, compiled.filters))
    if (!entry || entry.status === 'loading') return { ...row, loading: true, disabled: true }
    if (entry.status === 'error') return { ...row, hint: entry.message, disabled: true, error: true }

    const { rows, total } = entry.value
    if (total > rows.length) {
      return {
        ...row,
        hint: t('labels.commandPalette.where.tooMany', { count: total, cap: WHERE_ROW_CAP }),
        disabled: true,
        error: true,
      }
    }
    if (!rows.length) return { ...row, hint: t('labels.commandPalette.where.noMatch'), disabled: true }
    const pv = table.columns?.find((c) => c.pv)
    const labels = rows.map((r, i) => String((pv && r[pv.title!]) ?? extractPkFromRow(r, table.columns as ColumnType[]) ?? i + 1))
    const prevs = rows.map((r) => r[column.title!])
    const nexts = prevs.map((prev) => next(prev))
    const count = rows.length
    return {
      ...row,
      value: t('labels.commandPalette.where.count', { count }, count),
      run: () =>
        showWarningModal({
          title: t('labels.commandPalette.relative.confirmTitle', { count }, count),
          content: `${row.title} · ${relativeEdit.changeList(column, labels, prevs, nexts, table) || '—'}`,
          showCancelBtn: true,
          okText: t('general.update'),
          okCallback: async () => {
            $e('c:command-palette:where-edit:confirm', { count: cmdNlCountBucket(count), uidt: column.uidt })
            await saveWhere(key, rows, column, next)
          },
          cancelCallback: () => $e('c:command-palette:where-edit:cancel', { count: cmdNlCountBucket(count), uidt: column.uidt }),
        }),
    }
  }

  /** "new deal Acme 5000 won": shows what goes where; Enter inserts it without the form. */
  function createRow(row: CmdCommand, ir: CmdIR): CmdCommand {
    const table = ctx.meta.value!
    if (
      !(ctx.isGrid.value || ctx.isGallery.value || ctx.isKanban.value) ||
      !isUIAllowed('dataInsert') ||
      isDataReadOnly.value ||
      ctx.isSqlView.value ||
      table.synced ||
      !isPermissionAllowed(PermissionEntity.TABLE, table.id!, PermissionKey.TABLE_RECORD_ADD)
    ) {
      return { ...row, hint: t('labels.commandPalette.nl.cannotCreate'), disabled: true }
    }
    const values: Record<string, unknown> = {}
    for (const [id, value] of Object.entries(ir.create?.values ?? {})) {
      const column = columnOf(id)
      const cell = column && cellValue(column, value)
      if (!column || cell === undefined) {
        return {
          ...row,
          hint: t('labels.commandPalette.where.invalidValue', { value: scalarText(value), field: column?.title ?? id }),
          disabled: true,
          error: true,
        }
      }
      values[column.title!] = cell
    }
    return {
      ...row,
      feedback: t('labels.commandPalette.data.created'),
      run: async () => {
        await $api.dbViewRow.create('noco', table.base_id!, table.id!, ctx.view.value!.id!, values)
        ctx.reloadViewDataHook.trigger()
      },
    }
  }

  /* --------------------------------------------- completion ------------------------------------------ */

  /** Prefix lookup of a text field's distinct values on the server, for values the loaded rows don't have. */
  function lookupValues(field: CmdNlField, prefix: string): string[] {
    const table = ctx.meta.value
    const viewId = ctx.view.value?.id
    if (!table?.id || !viewId) return []
    const key = JSON.stringify([viewId, field.id, prefix.toLowerCase()])
    const entry = valueLookups.get(key)
    enqueue(key, entry, async () => {
      valueLookups.set(key, { status: 'loading', at: Date.now() })
      try {
        const data = await $api.dbViewRow.list('noco', table.base_id!, table.id!, viewId, {
          fields: [field.title],
          filterArrJson: JSON.stringify([{ fk_column_id: field.id, comparison_op: 'like', value: prefix, logical_op: 'and' }]),
          limit: 50,
          offset: 0,
        })
        const values = [...new Set((data.list ?? []).map((r) => (r as Record<string, unknown>)[field.title]))]
          .filter((v): v is string => typeof v === 'string' && !!v.trim())
          .slice(0, MAX_SUGGESTIONS)
        valueLookups.set(key, { status: 'done', value: values, at: Date.now() })
      } catch (e) {
        valueLookups.set(key, { status: 'error', message: await extractSdkResponseErrorMsg(e as Error), at: Date.now() })
      }
    })
    return entry?.status === 'done' ? entry.value : []
  }

  function completionRow(id: string, text: string, label: string, icon?: CmdIcon): CmdCommand {
    const kind = id.split(':')[0]
    return {
      id: `data:nl:complete:${id}`,
      lead: true,
      title: text,
      hint: label,
      section: t('labels.commandPalette.nl.suggestions'),
      icon: icon ?? { type: 'icon', name: 'ncCornerDownRight' },
      complete: `${text} `,
      tele: { kind: 'suggestion', slot: kind === 'field' || kind === 'cmp' ? kind : 'value' },
    }
  }

  /**
   * Completions for the half-typed word (or the next one) from the parser's suggester: field names,
   * type-valid operators, a field's values. Text fields also get server values beyond the loaded rows.
   */
  function completions(
    query: string,
    nlSchema: CmdNlSchema,
    rows?: Record<string, unknown>[],
  ): { rows: CmdCommand[]; partialValue: boolean; exactTyped: boolean } {
    const suggestions = cmdNlSuggest(query, nlSchema, { rows })
    const head = query.slice(0, suggestions.from)
    // A lone first word is a command search, not a half-written query.
    if (!head.trim()) return { rows: [], partialValue: false, exactTyped: false }
    const lower = suggestions.partial.toLowerCase()
    const field = suggestions.fieldId ? cmdNlField(nlSchema, suggestions.fieldId) : undefined

    const typedAs = (label: string) => cmdNlValueTyped(query, label)
    let exactTyped = false
    // A value already typed in full isn't offered again ("…is Northstar Analytics").
    const fresh = (item: CmdNlSuggestion) => {
      if (item.kind !== 'value' || typedAs(item.label) !== 'exact') return item.insert.toLowerCase() !== lower
      exactTyped = true
      return false
    }

    const items = suggestions.items.filter(fresh)
    if (field?.kind === 'text' && lower.length >= 2 && items.every((item) => item.kind === 'value')) {
      const seen = new Set(items.map((item) => item.insert.toLowerCase()))
      for (const value of lookupValues(field, suggestions.partial)) {
        const item: CmdNlSuggestion = { kind: 'value', label: value, insert: value, fieldId: field.id }
        if (seen.has(value.toLowerCase()) || !fresh(item)) continue
        seen.add(value.toLowerCase())
        items.push(item)
      }
    }
    // A multi-word value replaces every word of it already typed, not only the last ("Northstar Anal").
    for (const item of items) {
      if (item.kind !== 'value' || item.from !== undefined || item.insert.startsWith(' ')) continue
      const tail = cmdNlValueTail(query, item.label)
      if (tail?.kind === 'prefix' && tail.from < suggestions.from) item.from = tail.from
    }

    const shown = items.slice(0, MAX_SUGGESTIONS)
    // A trailing space ends the value: only a word still being typed is partial.
    const partialValue =
      !exactTyped &&
      !!lower &&
      !/\s$/.test(query) &&
      shown.some((item) => item.kind === 'value' && typedAs(item.label) === 'prefix')
    const rowsOut = shown.map((item) => {
      const column = item.fieldId ? columnOf(item.fieldId) : undefined
      const hint =
        item.kind === 'field'
          ? t('labels.commandPalette.nl.field')
          : item.kind === 'cmp'
          ? t('labels.commandPalette.nl.operator')
          : field?.title ?? ''
      const icon: CmdIcon | undefined = item.kind === 'field' && column ? { type: 'field', column } : undefined
      const text = `${query.slice(0, item.from ?? suggestions.from)}${item.insert}`
      const row = completionRow(`${item.kind}:${item.fieldId ?? ''}:${item.insert}`, text, hint, icon)
      return item.kind === 'value' ? withResult(row, text, nlSchema, rows) : row
    })
    return { rows: rowsOut, partialValue, exactTyped }
  }

  /**
   * A value suggestion that completes the query into a confident reading shows that reading's result
   * (a figure, a share, a record count) and runs it on Enter; Tab and → still only complete the text.
   */
  function withResult(row: CmdCommand, text: string, nlSchema: CmdNlSchema, rows?: Record<string, unknown>[]): CmdCommand {
    const [ir] = parse(text, nlSchema, rows)
    if (!ir) return row
    // An unsure or unrunnable completion still shows how it would read, as tentative chips.
    const chipsOnly = { ...row, reading: { chips: chipsOf(ir, text) } }
    if (ir.meta.unsure || !['stat', 'filter', 'edit'].includes(ir.intent) || (ir.intent === 'edit' && ir.scope !== 'where')) {
      return chipsOnly
    }
    const result = readingRow(ir, text, '', 0, false)
    if (!result) return chipsOnly
    // A filter shows how many records it keeps; Enter still adds the filter.
    const counted =
      ir.intent === 'filter' && ir.where && !ir.orderBy?.length && canStat.value
        ? statRow({ ...result }, { ...ir, intent: 'stat', aggs: [{ fn: 'count' }] }, false)
        : undefined
    const value = counted?.value ?? result.value
    return {
      ...row,
      title: result.title,
      icon: result.icon,
      reading: result.reading,
      value:
        counted?.value !== undefined && !result.value
          ? t(
              'labels.commandPalette.where.count',
              { count: Number(counted.value.replace(/,/g, '')) },
              Number(counted.value.replace(/,/g, '')),
            )
          : value,
      loading: counted?.loading ?? result.loading,
      error: result.error,
      run: result.run,
      feedback: result.feedback,
    }
  }

  /* --------------------------------------------- rows ------------------------------------------------ */

  /** A run reading is remembered: it ranks a little higher next time and shows as a recent query. */
  function remembering(row: CmdCommand | undefined, ir: CmdIR, query: string): CmdCommand | undefined {
    const run = row?.run
    if (!row || !run) return row
    return {
      ...row,
      run: () => {
        remember(ctx.meta.value?.id, query, ir)
        return run()
      },
    }
  }

  /** `prefix` is the part of the typed query before `text` ("percent of "), kept when a chip rewrites it. */
  function readingRow(ir: CmdIR, text: string, prefix: string, index: number, unsure: boolean): CmdCommand | undefined {
    return remembering(readingRowOf(ir, text, prefix, index, unsure), ir, `${prefix}${text}`)
  }

  function readingRowOf(ir: CmdIR, text: string, prefix: string, index: number, unsure: boolean): CmdCommand | undefined {
    const nlSchema = schema.value!
    const nativeShare = ir.aggs?.[0]?.fn === CMD_NL_SHARE
    const share = !!prefix
    const sentence = canonical(ir, nlSchema)
    // "Sum of Annual revenue where …" → "Share of Annual revenue where …"; a count is a share of records.
    const shared = sentence.replace(/^Sum of /, '').replace(/^Count\b/, t('labels.commandPalette.nl.records'))
    const chips = chipsOf(ir, text).map((chip) => ({
      ...chip,
      swaps: chip.swaps?.map((swap) => ({ ...swap, query: `${prefix}${swap.query}` })),
    }))
    const base: CmdCommand = {
      id: `data:nl:${index}`,
      lead: true,
      title: share ? t('labels.commandPalette.nl.shareOf', { stat: shared }) : sentence,
      hint: unsure ? t('labels.commandPalette.nl.unsure') : undefined,
      section: t('labels.commandPalette.nl.section'),
      icon: { type: 'icon', name: share || nativeShare ? 'ncPercent' : ICON_OF[ir.intent] ?? 'ncZap' },
      reading: { chips },
      tele: {
        kind: 'reading',
        reading: cmdNlReadingTele(ir, nlSchema, index),
        tagger: !!getCmdNlTagger(),
        surface: surface.value,
      },
    }
    switch (ir.intent) {
      case 'stat':
        if (!canStat.value) return undefined
        if (ir.aggs?.[0]?.fn === CMD_NL_RATIO) return ratioRow(base, ir)
        // A native share compares its base (a field's sum, or the record count) with the whole view.
        if (nativeShare) {
          const agg = ir.aggs![0]!
          if (ir.groupBy?.length) return groupShareRow(base, ir)
          return statRow(
            base,
            { ...ir, aggs: [{ fn: agg.base ?? 'sum', field: agg.base === 'count' ? undefined : agg.field }] },
            true,
          )
        }
        return statRow(base, ir, share)
      case 'filter':
        if (ir.orderBy?.length) return sortRow(base, ir)
        return filterRow(base, ir)
      case 'sort':
        return sortRow(base, ir)
      case 'group':
        return groupRow(base, ir)
      case 'edit':
        return ir.scope === 'where' ? whereEditRow(base, ir) : undefined
      case 'create':
        return createRow(base, ir)
      default:
        return undefined
    }
  }

  /** The view provider's fallbacks: readings of the query first (or completions while a value is half typed). */
  function nlCommands(query: string): CmdCommand[] {
    const table = ctx.meta.value
    const nlSchema = schema.value
    if (!table?.id || !ctx.view.value?.id || !nlSchema) return []

    const rows = sampleRows()
    const anchors = rows?.length ? rows : undefined
    // The parser reads shares itself ("percent of revenue where …" → fn 'share'); the wrapper is a fallback.
    const started = performance.now()
    const native = parse(query, nlSchema, anchors)
    const latency = cmdNlLatencyBucket(performance.now() - started)
    const nativeFn = native[0]?.aggs?.[0]?.fn
    const share = nativeFn === CMD_NL_SHARE || nativeFn === CMD_NL_RATIO ? null : SHARE_OF.exec(query)
    const text = share ? share[1]! : query
    const prefix = query.slice(0, query.length - text.length)
    const parsed = share ? parse(text, nlSchema, anchors) : native
    const readings = share ? shareReadings(parsed, text, nlSchema, anchors) : parsed

    const unsure = !!readings[0]?.meta.unsure
    const rowsOut = readings
      .slice(0, unsure ? UNSURE_READINGS : 1)
      .map((ir, i) => readingRow(ir, text, prefix, i, unsure))
      .filter((row): row is CmdCommand => !!row)
      .map((row) => (row.tele?.kind === 'reading' ? { ...row, tele: { ...row.tele, latency, readings: readings.length } } : row))

    // Completions run on the whole query: the parser reads shares itself, so "percentage of … is " completes too.
    const { rows: suggestions, partialValue, exactTyped } = completions(query, nlSchema, anchors)
    // While a value is being typed ("industry is manu") its completions lead; once the query reads as a
    // confident action ("…where Company Name is Northstar Analytics"), the action leads and they follow.
    const valueSlot = suggestions.some((s) => s.id.startsWith('data:nl:complete:value:'))
    // A row still fetching its figure counts: the order must not flip when the answer arrives.
    const confident = rowsOut.length > 0 && !unsure && (!rowsOut[0]!.disabled || !!rowsOut[0]!.loading)
    // A value typed in full is a finished query even when the reading is unsure: its action leads.
    if (valueSlot && !exactTyped && (partialValue || !confident)) return [...suggestions, ...rowsOut]
    const trailing = parsed.length ? suggestions.map((s) => ({ ...s, lead: false })) : suggestions
    // Nothing read and nothing to complete: say why, with the fixes the parser can name.
    const declined = !readings.length && !suggestions.length ? diagnosisRows(query, nlSchema, anchors) : []
    return [...rowsOut, ...trailing, ...declined]
  }

  /** Fix rows under the one hint. */
  const MAX_FIXES = 5

  /** Reasons that name the field or value at fault; "Don't know X" and the like aren't worth a row. */
  const SPECIFIC_REASONS = new Set(['no-value', 'bad-op-for-type', 'unsupported-agg', 'ambiguous', 'no-field'])

  /**
   * Why a non-trivial query has no reading, as one muted hint and only when it helps: it names the
   * field or value at fault, and the fixes it can offer rewrite those words ("maybe" → Lead, Won…).
   */
  function diagnosisRows(query: string, nlSchema: CmdNlSchema, rows?: Record<string, unknown>[]): CmdCommand[] {
    // One word is a command search; a dangling clause ("…where") is still being typed.
    if (query.trim().split(/\s+/).length < 2) return []
    const d = cmdNlDiagnose(query, nlSchema, { rows }).find(
      (x) => SPECIFIC_REASONS.has(x.reason) && (!!x.field || !!(x.span && x.suggestion?.length)),
    )
    if (!d) return []
    const fixes = d.span ? d.suggestion?.slice(0, MAX_FIXES) ?? [] : []
    const section = fixes.length ? t('labels.commandPalette.nl.didYouMean') : undefined
    const hint: CmdCommand = {
      id: 'data:nl:diagnose:0',
      lead: true,
      title: d.text,
      section,
      icon: { type: 'icon', name: 'ncInfo' },
      disabled: true,
      tele: { kind: 'decline', reason: d.reason, fix: false },
    }
    const [start, end] = d.span ?? [0, 0]
    return [
      hint,
      ...fixes.map((fix, j) => {
        const text = `${query.slice(0, start)}${fix}${query.slice(end)}`
        return {
          id: `data:nl:diagnose:0:${j}`,
          lead: true,
          title: text,
          hint: fix,
          section,
          icon: { type: 'icon', name: 'ncCornerDownRight' },
          complete: text,
          tele: { kind: 'decline', reason: d.reason, fix: true },
        } satisfies CmdCommand
      }),
    ]
  }

  /**
   * A share is a sum or count of the matching records over the whole view: "percent of revenue where …"
   * (no aggregation word means the sum), "% of deals that are won" (a count).
   */
  function shareReadings(parsed: CmdIR[], text: string, nlSchema: CmdNlSchema, anchors?: Record<string, unknown>[]) {
    const pick = (list: CmdIR[]) =>
      list.flatMap((ir): CmdIR[] => {
        if (ir.intent === 'filter' && ir.where && !ir.orderBy?.length) return [{ ...ir, intent: 'stat', aggs: [{ fn: 'count' }] }]
        return ir.intent === 'stat' && ir.aggs?.[0] && ['sum', 'count'].includes(ir.aggs[0].fn) ? [ir] : []
      })
    const direct = pick(parsed)
    const summed = /^\s*(sum|total|count|number)\b/i.test(text) ? [] : pick(parse(`sum of ${text}`, nlSchema, anchors))
    // "revenue where …" names a number field: its sum beats counting the records that have one.
    return [...summed, ...direct.filter((ir) => !summed.length || ir.aggs?.[0]?.fn !== 'count')]
  }

  /** Recent rows shown with an empty query, and while a query is this short and starts one of them. */
  const RECENT_ROWS = 4
  const RECENT_PREFIX = 2

  /** The user's recent NL queries on this table, each with its live result; Enter runs, Tab fills the input. */
  function recentCommands(query: string): CmdCommand[] {
    const table = ctx.meta.value
    const nlSchema = schema.value
    const typed = query.trim().toLowerCase()
    if (!table?.id || !ctx.view.value?.id || !nlSchema || typed.length > RECENT_PREFIX) return []
    const rows = sampleRows()
    const anchors = rows?.length ? rows : undefined
    const seen = new Set<string>()
    const out: CmdCommand[] = []
    for (const entry of historyFor(table.id)) {
      const key = entry.query.toLowerCase()
      if (seen.has(key) || (typed && !key.startsWith(typed))) continue
      seen.add(key)
      const [ir] = parse(entry.query, nlSchema, anchors)
      const row = ir && readingRow(ir, entry.query, '', 0, false)
      if (!row) continue
      out.push({
        ...row,
        id: `data:nl:recent:${key}`,
        title: entry.query,
        // The query as the user typed it is the title; its reading would mostly repeat it.
        hint: row.hint,
        section: t('labels.commandPalette.nl.recentQueries'),
        icon: { type: 'icon', name: 'ncClock' },
        complete: entry.query,
        // Running it is a reading run; Tab filling the input is a history suggestion accepted.
        tele: row.tele,
      })
      if (out.length >= RECENT_ROWS) break
    }
    return out
  }

  return Object.assign(nlCommands, { skeleton: skeletonOf, recent: recentCommands })
}
