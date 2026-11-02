import type { ColumnType, TableType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import { getOptions as getUserOptions } from '~/components/cell/User/utils'
import { userLocalStorageInfoManager } from '#imports'
import type { CmdNlHistoryEntry } from '~/utils/cmdNl/history'
import { cmdNlPattern, cmdNlTemplate } from '~/utils/cmdNl/history'
import type { CmdIR } from '~/utils/cmdNl/ir'
import { loadCmdNlDates } from '~/utils/cmdNl/extract'
import type { CmdNlParseOptions } from '~/utils/cmdNl/parse'
import { parseCmdNl } from '~/utils/cmdNl/parse'
import type { CmdNlMember, CmdNlSchema } from '~/utils/cmdNl/schema'
import { buildCmdNlSchema } from '~/utils/cmdNl/schema'
import { loadCmdNlTagger } from '~/utils/cmdNl/taggerScore'
import { warmCmdNl } from '~/utils/cmdNl/warm'

/** Schemas per table meta; rebuilt when the meta object or the base's member list changes. */
const schemaCache = new WeakMap<TableType, { members: unknown; me?: string; schema: CmdNlSchema }>()

/** Last readings per schema and query: the view and the active surface parse the same text per keystroke. */
const parseCache = new WeakMap<CmdNlSchema, Map<string, CmdIR[]>>()

const PARSE_CACHE_SIZE = 30

let prepared = false

/** Loads the parser's lazy chunks once: chrono-node for dates and the tagger model; parsing works before they land. */
function prepare() {
  if (prepared) return
  prepared = true
  Promise.all([loadCmdNlDates(), loadCmdNlTagger()]).catch(() => (prepared = false))
}

/** Schemas already warmed for a given set of rows, so reopening the palette doesn't redo it. */
const warmed = new WeakMap<CmdNlSchema, unknown>()

/** Picks remembered per table, and tables kept, per user and workspace. */
const HISTORY_PER_TABLE = 40
const HISTORY_TABLES = 30

/** Remembered NL picks: table id → entries, newest first. Loaded per user and workspace. */
const history = ref<Record<string, CmdNlHistoryEntry[]>>({})

/** Bumped on every pick, so parse caches keyed on history don't serve a stale ranking. */
const historyVersion = ref(0)

let historyOwner: string | undefined

/** The Cmd+K NL parser bound to the signed-in user and the base's members. */
export function useCmdNl() {
  const { user } = useGlobal()

  const { basesUser } = storeToRefs(useBases())

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  function loadHistory() {
    const owner = `${user.value?.id}:${activeWorkspaceId.value}`
    if (!user.value?.id || !activeWorkspaceId.value || historyOwner === owner) return
    historyOwner = owner
    history.value = userLocalStorageInfoManager.get(user.value.id, activeWorkspaceId.value, 'cmdNlHistory') ?? {}
  }

  /** Picks the user made on this table, newest first. */
  function historyFor(tableId: string | undefined): CmdNlHistoryEntry[] {
    loadHistory()
    return tableId ? history.value[tableId] ?? [] : []
  }

  /** Records a run reading: its masked query and shape, for ranking and the recent-queries rows. */
  function remember(tableId: string | undefined, query: string, ir: CmdIR) {
    const text = query.trim()
    if (!tableId || !text || !user.value?.id || !activeWorkspaceId.value) return
    loadHistory()
    const pattern = cmdNlPattern(text)
    const template = cmdNlTemplate(ir)
    const entries = history.value[tableId] ?? []
    const prev = entries.find((e) => e.pattern === pattern && e.template === template)
    const entry: CmdNlHistoryEntry = { pattern, template, query: text, count: (prev?.count ?? 0) + 1, at: Date.now() }
    const tables = { ...history.value, [tableId]: [entry, ...entries.filter((e) => e !== prev)].slice(0, HISTORY_PER_TABLE) }
    // Over the table cap, the tables used longest ago go first.
    const kept = Object.entries(tables)
      .sort((a, b) => (b[1][0]?.at ?? 0) - (a[1][0]?.at ?? 0))
      .slice(0, HISTORY_TABLES)
    history.value = Object.fromEntries(kept)
    historyVersion.value++
    userLocalStorageInfoManager.set(user.value.id, activeWorkspaceId.value, 'cmdNlHistory', history.value)
  }

  function membersOf(meta: TableType) {
    const baseUsers = meta.base_id ? basesUser.value.get(meta.base_id) ?? [] : []
    return (column: ColumnType): CmdNlMember[] =>
      column.uidt === UITypes.User
        ? getUserOptions(column, false, false, baseUsers)
            .filter((option) => !option.deleted && option.id)
            .map((option) => ({ id: option.id!, name: option.display_name || option.email || '', email: option.email }))
        : []
  }

  function schemaFor(meta: TableType | undefined): CmdNlSchema | undefined {
    if (!meta?.columns?.length) return
    const members = meta.base_id ? basesUser.value.get(meta.base_id) : undefined
    const hit = schemaCache.get(meta)
    if (hit && hit.members === members && hit.me === user.value?.id) return hit.schema
    const schema = buildCmdNlSchema(meta, { members: membersOf(meta), me: user.value?.id })
    schemaCache.set(meta, { members, me: user.value?.id, schema })
    return schema
  }

  /**
   * Readings of `query`, best first; `rows` are loaded records used as value anchors ("manufacturing companies").
   * `extra` carries per-call options (the learned history boost); it is part of the cache key.
   */
  function parse(
    query: string,
    schema: CmdNlSchema,
    rows?: Record<string, unknown>[],
    extra?: Pick<CmdNlParseOptions, 'history' | 'anchors'> & { key?: string },
  ): CmdIR[] {
    const text = query.trim()
    if (!text) return []
    prepare()
    let byQuery = parseCache.get(schema)
    if (!byQuery) parseCache.set(schema, (byQuery = new Map()))
    const anchors = extra?.anchors ? JSON.stringify(extra.anchors) : ''
    const key = `${rows?.length ?? 0}\u0000${extra?.key ?? ''}\u0000${anchors}\u0000${text}`
    const hit = byQuery.get(key)
    if (hit) return hit
    const readings = parseCmdNl(text, schema, { rows, history: extra?.history, anchors: extra?.anchors })
    byQuery.set(key, readings)
    if (byQuery.size > PARSE_CACHE_SIZE) byQuery.delete(byQuery.keys().next().value!)
    return readings
  }

  /** On palette open, in idle time: load the lazy chunks and build what the first keystroke would pay for. */
  function warm(schema: CmdNlSchema | undefined, rows?: Record<string, unknown>[]) {
    prepare()
    if (!schema || warmed.get(schema) === (rows ?? null)) return
    warmed.set(schema, rows ?? null)
    warmCmdNl(schema, rows)
  }

  return { schemaFor, parse, warm, historyFor, remember, historyVersion }
}
