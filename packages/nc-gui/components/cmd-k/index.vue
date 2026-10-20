<script lang="ts" setup>
import type { CmdChip, CmdCommand, CmdLevel, CmdSkeleton, CmdTele, CommandPaletteType } from '~/lib/types'
import { CMD_LEVELS, cmdRowDomId, isCmdNaturalLanguage } from '~/utils/commandPaletteUtils'

type CmdRow = { kind: 'section'; title: string } | { kind: 'command'; command: CmdCommand }

const props = defineProps<{
  open: boolean
  setActiveCmdView: (cmd: CommandPaletteType) => void
}>()

const emits = defineEmits(['update:open'])

const vOpen = useVModel(props, 'open', emits)

const { $e } = useNuxtApp()

const { user } = useGlobal()

const { activeScope, loadScope, cmdLoading } = useCommandPalette()

const { providers: registeredProviders } = useCommandRegistry()

const { isAiAvailable, askAi, aiFallback } = useGlobalCommands()

const { commandUsage, recordCommandUse } = useCommand()

const { t } = useI18n()

const ROW_HEIGHT = 36

/** Openers of a question about records: an aggregate, "how many", or a sort/group/filter of them. */
const CMD_DATA_QUESTION =
  /^\s*(?:sum|total|average|avg|mean|median|count|number of|how many|how much|max|maximum|min|minimum|top \d+|group by|sort by|filter|records|rows)\b/i

const inputEl = ref<HTMLInputElement | HTMLTextAreaElement>()

const query = ref('')

/** Lags `query` by 60ms; Enter flushes it so a fast type-and-Enter never runs a stale row. */
const debouncedQuery = ref('')

watchDebounced(query, (value) => (debouncedQuery.value = value), { debounce: 60 })

/** `query` one paint later: the chips follow every keystroke without holding up the typed character. */
const chipQuery = ref('')

let chipFrame: number | undefined

watch(query, (value) => {
  if (chipFrame !== undefined) cancelAnimationFrame(chipFrame)
  if (!value) return (chipQuery.value = '')
  chipFrame = requestAnimationFrame(() => {
    chipFrame = undefined
    setTimeout(() => (chipQuery.value = query.value))
  })
})

/** Set once the user moves the selection; until then the first row stays selected as rows arrive. */
const navigated = ref(false)

/** How many context chips Backspace has removed, most specific first. */
const dismissedLevels = ref(0)

/** Commands whose children are being browsed, outermost first. */
const pages = ref<CmdCommand[]>([])

const selectedId = ref<string>()

/** The command whose value is being edited in place of the search input. */
const editing = ref<CmdCommand>()

const editValue = ref('')

const editError = ref<string>()

const isSaving = ref(false)

const isSaved = ref(false)

/** Which way the body slides: into a submenu or editor, or back out of one. */
const navDirection = ref<'forward' | 'back'>('forward')

/** In-place result of a command with `feedback`, shown on its own row instead of a toast. */
const rowStatus = ref<{ id: string; kind: 'pending' | 'success' | 'error'; text?: string }>()

/** How long a confirmation stays on screen before the palette closes. */
const FEEDBACK_MS = 800

let closeTimer: ReturnType<typeof setTimeout> | undefined

/** A row with `feedback` is saving or has saved: a second Enter or click must not run it again. */
let isRunning = false

/** Enter pressed while the leading reading was still fetching its answer: it runs once that settles. */
const pendingEnterId = ref<string>()

// Closed, no provider is read: the palette stays mounted and would rebuild on every cell click.
const providers = computed(() => (vOpen.value ? registeredProviders.value : []))

const contextLevels = computed(() => getCmdContextLevels(providers.value))

const activeContext = computed(() => contextLevels.value[dismissedLevels.value])

const activeLevel = computed<CmdLevel>(() => activeContext.value?.level ?? 'global')

const activePage = computed(() => pages.value[pages.value.length - 1])

const isSearching = computed(() => !!debouncedQuery.value.trim())

const breadcrumbs = computed(() => [...pages.value, ...(editing.value ? [editing.value] : [])])

/** The provider whose chip is showing; only it may add query-built edits ("add 1 week"). */
const activeContextProvider = computed(() =>
  providers.value.findLast((provider) => provider.level === activeLevel.value && provider.context),
)

/** "Create “name”", docs search and the like: they echo the query, so they are not ranked by use. */
const fallbacks = computed<CmdCommand[]>(() =>
  activePage.value || !isSearching.value
    ? []
    : providers.value.flatMap((provider) => {
        // A data answer from a dismissed chip's provider still runs there, so the row names it.
        const dismissed = CMD_LEVELS.indexOf(provider.level) < CMD_LEVELS.indexOf(activeLevel.value)
        const where = dismissed ? provider.context?.prefix ?? provider.context?.label : undefined
        return (provider.fallbacks?.(debouncedQuery.value.trim()) ?? [])
          .filter(
            // Data answers (calc, stats, quick create) lead from any level; edits only from the active chip.
            (command) => !command.lead || provider === activeContextProvider.value || command.id.startsWith('data:'),
          )
          .map((command) =>
            where && command.id.startsWith('data:')
              ? { ...command, hint: [where, command.hint].filter(Boolean).join(' · ') }
              : command,
          )
      }),
)

/** A data question ("sum of amount") at base level, with no table open: say so instead of offering creates. */
const noTableRow = computed<CmdCommand | undefined>(() => {
  if (activePage.value || activeLevel.value !== 'base' || providers.value.some((p) => p.level === 'view')) return
  if (!CMD_DATA_QUESTION.test(debouncedQuery.value)) return
  return {
    id: 'data:nl:open-table',
    lead: true,
    title: t('labels.commandPalette.nl.openTableToAsk'),
    section: t('labels.commandPalette.nl.section'),
    icon: { type: 'icon', name: 'ncInfo' },
    disabled: true,
    tele: { kind: 'decline', reason: 'no-table', fix: false },
  }
})

/** Query-built edits lead; the other fallbacks stay after the matches. */
const leadFallbacks = computed(() => [
  ...(noTableRow.value ? [noTableRow.value] : []),
  ...fallbacks.value.filter((command) => command.lead),
])

// A query read as an edit ("add 10 to amount") isn't also a name for a new table, view…
// Searching records or docs comes before naming something new after the query, unless it starts "create"/"new".
const trailingFallbacks = computed(() => {
  const createFirst = /^\s*(create|new)\s/i.test(debouncedQuery.value)
  const rank = (command: CmdCommand) =>
    command.id.endsWith(':create-named') ? (createFirst ? 3 : 0) : command.id.endsWith(':search-for') ? 2 : 1
  return fallbacks.value
    .filter((command) => !command.lead && !(leadFallbacks.value.length && command.id.endsWith(':create-named')))
    .sort((a, b) => rank(b) - rank(a))
})

const aiRow = computed(() => (activePage.value || !isSearching.value ? undefined : aiFallback(debouncedQuery.value.trim())))

/** Recent natural-language queries (with their results): with an empty query, or one this short that starts one. */
const recentRows = computed<CmdCommand[]>(() => {
  if (activePage.value || editing.value) return []
  // Not from a level whose chip was dismissed: its recents would run there unannounced.
  const own = activeContextProvider.value?.recent
    ? activeContextProvider.value
    : providers.value.find((p) => p.recent && CMD_LEVELS.indexOf(p.level) >= CMD_LEVELS.indexOf(activeLevel.value))
  return own?.recent?.(debouncedQuery.value.trim()) ?? []
})

/**
 * Whether the query is mid-way through a field or value: a completion row, or a skeleton chip that reads part
 * of it. The AI row then waits at the end unless the query is an explicit question.
 */
function isBeingTyped(text: string) {
  if (leadFallbacks.value.some((command) => command.complete !== undefined)) return true
  const own = activeContextProvider.value?.skeleton ? activeContextProvider.value : providers.value.find((p) => p.skeleton)
  const skeleton = own?.skeleton?.(text)
  return !!skeleton?.ghost || !!skeleton?.chips.some((chip) => ['field', 'agg', 'cmp', 'value'].includes(chip.kind))
}

const results = computed<CmdCommand[]>(() => {
  if (activePage.value) {
    const children = (activePage.value.children?.() ?? []).map((child) => ({ ...child, searchOnly: false }))
    return searchCmdCommands(children, debouncedQuery.value)
  }

  const scoped = getCmdScopedCommands(providers.value, activeLevel.value, isSearching.value, commandUsage.value)
  const contextIds = new Set(
    providers.value.filter((p) => p.level !== 'global').flatMap((p) => p.commands.map((command) => command.id)),
  )
  const found = searchCmdCommands(scoped, debouncedQuery.value, contextIds, commandUsage.value)
  // On a record, field or selection its own actions come first; the view's recent queries follow.
  if (!isSearching.value) {
    return CMD_LEVELS.indexOf(activeLevel.value) < CMD_LEVELS.indexOf('view')
      ? [...found, ...recentRows.value]
      : [...recentRows.value, ...found]
  }
  // A match with the same effect as a reading ("Group by › Stage" next to "Group by Stage") isn't listed twice.
  const covered = new Set(leadFallbacks.value.flatMap((c) => (c.dedupeKey ? [c.dedupeKey] : [])))
  const matches = covered.size ? found.filter((c) => !c.dedupeKey || !covered.has(c.dedupeKey)) : found

  // A request leads with "Ask NocoAI"; a command-like query keeps its matches and echo rows first.
  const ai = aiRow.value
  // A fallback row still working (it can be cancelled) holds the list until it settles.
  if (ai?.loading && ai.cancel) return [ai]
  // "Not understood" only when nothing else answered: a matching command means the query was understood.
  const leadRows = matches.length ? leadFallbacks.value.filter((c) => c.tele?.kind !== 'decline') : leadFallbacks.value
  const lead = [...recentRows.value, ...leadRows]
  if (!ai) return [...lead, ...matches, ...trailingFallbacks.value]
  if (ai.trailing) return [...lead, ...matches, ...trailingFallbacks.value, ai]
  // Mid-typing ("…where company si"): what is being typed leads, not the AI, unless it ends with "?".
  const question = /\?\s*$/.test(debouncedQuery.value)
  if (!question && isBeingTyped(debouncedQuery.value)) return [...lead, ...matches, ...trailingFallbacks.value, ai]
  // "create workflow Foo" asks for the named create, not the AI; "add 1 week" asks for the edit.
  const namedCreate = /^\s*(create|new)\s/i.test(debouncedQuery.value)
    ? fallbacks.value.find((command) => command.id.endsWith(':create-named'))
    : undefined
  // A parsed answer or edit ("how many deals are won") beats the AI; with "?", only a confident reading does.
  const confident = lead.some((command) => command.tele?.kind === 'reading' && !command.tele.reading.unsure)
  const answered = lead.length > 0 && (!question || confident)
  return !answered &&
    isCmdNaturalLanguage(debouncedQuery.value, matches.length > 0 || !!namedCreate || lead.length > 0, matches[0]?.title)
    ? [ai, ...lead, ...matches, ...trailingFallbacks.value]
    : [...lead, ...matches, ...trailingFallbacks.value, ai]
})

const rows = computed<CmdRow[]>(() =>
  groupCmdCommands(results.value).flatMap(({ section, commands }) => [
    ...(section && (!activePage.value || activePage.value.groupChildren) ? [{ kind: 'section' as const, title: section }] : []),
    ...commands.map((command) => ({ kind: 'command' as const, command })),
  ]),
)

const selectableIds = computed(() =>
  rows.value.flatMap((row) => (row.kind === 'command' && !row.command.disabled ? [row.command.id] : [])),
)

/** Readings of the query (stat, filter, edit…): Tab moves between them when there is more than one. */
const readingRows = computed(() =>
  // Suggestions carry their completed reading too, but Tab completes them rather than cycling.
  activePage.value ? [] : results.value.filter((command) => command.reading && command.complete === undefined),
)

/** Nothing was read and the fallback row leads, or already ran (no `stayOpen`): no chips or completions. */
const fallbackLeads = computed(
  () => !!aiRow.value && !readingRows.value.length && (results.value[0]?.id === aiRow.value.id || !aiRow.value.stayOpen),
)

/**
 * The reading whose chips show: the selected one, else the first reading, else the best completion's
 * reading while the query is still half typed (shown tentative).
 */
const chipReading = computed(() =>
  isSearching.value
    ? results.value.find((c) => c.id === selectedId.value && c.reading) ??
      readingRows.value[0] ??
      results.value.find((c) => c.reading)
    : undefined,
)

/** Chips from a completion describe where the query is heading, not what it says yet. */
const chipsTentative = computed(() => chipReading.value?.complete !== undefined)

/** Before any reading: what each typed word stands for, and the field name being typed, completed. */
const skeleton = computed<CmdSkeleton | undefined>(() => {
  if (!chipQuery.value.trim() || activePage.value || editing.value) return
  if (chipReading.value?.reading?.chips.length && !chipsTentative.value) return
  const own = activeContextProvider.value?.skeleton ? activeContextProvider.value : providers.value.find((p) => p.skeleton)
  // Not debounced like the results: chips follow every keystroke, computed just after its paint.
  return own?.skeleton?.(chipQuery.value)
})

/** The chip row: the reading's chips, else a completion's (tentative), else the skeleton's (tentative). */
const shownChips = computed<{ chips: CmdChip[]; tentative: boolean; ghost?: CmdSkeleton['ghost'] }>(() => {
  if (fallbackLeads.value) return { chips: [], tentative: true }
  const reading = chipReading.value?.reading?.chips
  if (reading?.length && !chipsTentative.value) return { chips: reading, tentative: false }
  if (reading?.length) return { chips: reading, tentative: true, ghost: skeleton.value?.ghost }
  return { chips: skeleton.value?.chips ?? [], tentative: true, ghost: skeleton.value?.ghost }
})

/** The first completion row, accepted by Tab or → when nothing else claims the key. */
const firstCompletion = computed(() =>
  activePage.value || fallbackLeads.value ? undefined : results.value.find((c) => c.complete !== undefined),
)

/** A submenu opens on its current value (e.g. the active theme), else on the first row. */
function defaultSelectedId() {
  const current = activePage.value && !debouncedQuery.value ? results.value.find((c) => c.checked && !c.disabled) : undefined
  return current?.id ?? selectableIds.value[0]
}

/**
 * Windowed rows from the tracked scroll offset and observed height: a new result list reads no layout
 * (useVirtualList re-measured the container on every list change, forcing a layout per keystroke).
 */
const listEl = ref<HTMLElement>()

const listScrollTop = ref(0)

const { height: listHeight } = useElementSize(listEl)

const LIST_OVERSCAN = 5

const list = computed(() => {
  const viewport = listHeight.value || 480
  const start = Math.max(0, Math.floor(listScrollTop.value / ROW_HEIGHT) - LIST_OVERSCAN)
  const end = Math.min(rows.value.length, Math.ceil((listScrollTop.value + viewport) / ROW_HEIGHT) + LIST_OVERSCAN)
  return rows.value.slice(start, end).map((data, i) => ({ data, index: start + i }))
})

const containerProps = { ref: listEl, style: { overflowY: 'auto' as const } }

const wrapperProps = computed(() => {
  const offset = (list.value[0]?.index ?? 0) * ROW_HEIGHT
  return { style: { width: '100%', height: `${rows.value.length * ROW_HEIGHT - offset}px`, marginTop: `${offset}px` } }
})

/** Whether the list is scrolled off the top, tracked from scroll events (reading it on demand forces a layout). */
let scrolledAway = false

// A new list element (after the empty state) starts at the top.
watch(listEl, () => {
  listScrollTop.value = 0
  scrolledAway = false
})

useEventListener(
  listEl,
  'scroll',
  (e: Event) => {
    listScrollTop.value = (e.target as HTMLElement).scrollTop
    scrolledAway = listScrollTop.value > 0
  },
  { passive: true },
)

function focusInput() {
  nextTick(() => inputEl.value?.focus())
}

function show() {
  if (!user.value || activeScope.value.scope === 'disabled') return
  vOpen.value = true
}

function hide() {
  clearTimeout(closeTimer)
  vOpen.value = false
}

/** Share of palette sessions that send the NL query summary; every run, swap and decline is sent in full. */
const NL_SUMMARY_SAMPLE = 0.1

/** This session's top NL reading and which reading (if any) ran, for the sampled summary on close. */
let nlTop: Extract<CmdTele, { kind: 'reading' }> | undefined
let nlRanRank: number | undefined
const nlDeclinesSent = new Set<string>()

watch(results, (list) => {
  const top = list.find((c) => c.tele?.kind === 'reading')?.tele
  if (top?.kind === 'reading') nlTop = top
  const declines = list.flatMap((c) => (c.tele?.kind === 'decline' && !c.tele.fix ? [c.tele.reason] : []))
  const key = [...declines].sort().join(',')
  if (!declines.length || nlDeclinesSent.has(key)) return
  nlDeclinesSent.add(key)
  const hadFix = list.some((c) => c.tele?.kind === 'decline' && c.tele.fix)
  $e('a:command-palette:nl-decline:show', { reasons: declines, had_suggestion: hadFix, level: activeLevel.value })
})

watch(vOpen, (open) => {
  if (open) return
  if (nlTop && Math.random() < NL_SUMMARY_SAMPLE) {
    $e('a:command-palette:nl-query:summarize', {
      ...nlTop.reading,
      readings: nlTop.readings,
      latency: nlTop.latency,
      tagger: nlTop.tagger,
      surface: nlTop.surface,
      chosen_rank: nlRanRank ?? null,
    })
  }
  nlTop = undefined
  nlRanRank = undefined
  nlDeclinesSent.clear()
})

function trackSuggestion(command: CmdCommand | undefined, via: 'enter' | 'tab' | 'arrow', ghost = false) {
  if (ghost) return $e('c:command-palette:nl-suggestion:accept', { slot: 'ghost', via })
  if (command?.id.startsWith('data:nl:recent:')) return $e('c:command-palette:nl-suggestion:accept', { slot: 'history', via })
  if (command?.tele?.kind === 'suggestion') return $e('c:command-palette:nl-suggestion:accept', { slot: command.tele.slot, via })
  if (command?.tele?.kind === 'decline' && command.tele.fix) {
    return $e('c:command-palette:nl-decline:fix', { reason: command.tele.reason, via })
  }
  if (command?.tele?.kind === 'chip-swap') {
    return $e('c:command-palette:nl-chip:switch', { chip: command.tele.chip, uidt: command.tele.uidt ?? null })
  }
}

function closeSoon() {
  clearTimeout(closeTimer)
  closeTimer = setTimeout(hide, FEEDBACK_MS)
}

async function runWithFeedback(command: CmdCommand) {
  isRunning = true
  rowStatus.value = { id: command.id, kind: 'pending' }
  try {
    await command.run?.()
    rowStatus.value = { id: command.id, kind: 'success', text: command.feedback }
    closeSoon()
  } catch (e: unknown) {
    isRunning = false
    rowStatus.value = { id: command.id, kind: 'error', text: await extractSdkResponseErrorMsg(e as Error) }
  }
}

/** Actions only: a submenu pick counts for its menu; navigation rows and fallbacks are skipped. */
function recordUse(command: CmdCommand) {
  if (pages.value[0]) return recordCommandUse(pages.value[0].id)
  if ((command.searchOnly && !command.id.includes('>')) || fallbacks.value.includes(command) || command === aiRow.value) return
  if (/^data:nl:(complete|recent):/.test(command.id)) return
  recordCommandUse(command.id.split('>')[0]!)
}

function telemetryId(command: CmdCommand) {
  if (pages.value[0]) return `${pages.value[0].id}:pick`
  if (command.searchOnly && !command.id.includes('>')) return 'navigate'
  // Completion and recent ids carry typed values and queries: only their kind is sent.
  const nl = /^data:nl:(complete:[a-z]+|recent):/.exec(command.id)
  if (nl) return `data:nl:${nl[1]}`
  return command.id.split('>')[0]
}

function startEdit(command: CmdCommand) {
  navDirection.value = 'forward'
  editing.value = command
  editValue.value = command.edit!.value
  editError.value = undefined
  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
  })
}

// The compose textarea mounts after the page transition, later than startEdit's nextTick.
watch(inputEl, (el) => {
  if (el instanceof HTMLTextAreaElement && editing.value?.edit?.multiline) {
    el.focus()
    el.select()
  }
})

function cancelEdit() {
  navDirection.value = 'back'
  editing.value = undefined
  editError.value = undefined
  focusInput()
}

async function saveEdit() {
  const edit = editing.value?.edit
  if (!edit || isSaving.value || isSaved.value) return

  const value = edit.multiline ? editValue.value : editValue.value.trim()
  editError.value = edit.validate?.(value)
  if (editError.value) return

  $e('c:command-palette:command:run', { command: telemetryId(editing.value!), level: activeLevel.value })

  if (value === edit.value) {
    hide()
    return
  }

  isSaving.value = true
  try {
    await edit.submit(value)
    recordUse(editing.value!)
    isSaved.value = true
    closeSoon()
  } catch (e: unknown) {
    editError.value = await extractSdkResponseErrorMsg(e as Error)
  } finally {
    isSaving.value = false
  }

  // The input was disabled while saving, which dropped focus; give it back so Esc and a retry work.
  if (!isSaved.value) nextTick(() => inputEl.value?.focus())
}

/** Puts `text` in the input, as if typed: completions and chip swaps rewrite the query. */
function applyQuery(text: string) {
  navDirection.value = 'back'
  pages.value = []
  query.value = text
  debouncedQuery.value = text
  navigated.value = false
  focusInput()
}

/** A chip with alternatives opens them as a page; picking one rewrites the query. */
function openChip(chip: CmdChip, index: number) {
  if (!chip.swaps?.length) return
  execute({
    id: `chip:${index}`,
    title: `${chip.label ?? chip.text}…`,
    children: () =>
      chip.swaps!.map((swap, i) => ({
        id: `chip:${index}:${i}`,
        title: swap.label,
        icon: swap.icon,
        complete: swap.query,
        tele: {
          kind: 'chip-swap' as const,
          chip: chip.kind,
          uidt: chip.icon?.type === 'field' ? chip.icon.column?.uidt : undefined,
        },
      })),
  })
}

function execute(command: CmdCommand) {
  if (command.disabled || isRunning) return

  // A suggestion with a result runs on Enter (Tab / → complete it); one without just completes.
  if (command.complete !== undefined && !command.run) {
    trackSuggestion(command, 'enter')
    applyQuery(command.complete)
    return
  }

  if (command.children && !(command.runFirst && command.run)) {
    openChildren(command)
    return
  }

  if (command.edit && !command.upgradeFeature) {
    startEdit(command)
    return
  }

  $e('c:command-palette:command:run', { command: telemetryId(command), level: activeLevel.value })
  recordUse(command)
  if (command.tele?.kind === 'suggestion') trackSuggestion(command, 'enter')
  if (command.tele?.kind === 'reading') {
    nlRanRank = command.tele.reading.rank
    $e('c:command-palette:nl-reading:run', {
      intent: command.tele.reading.intent,
      rank: command.tele.reading.rank,
      was_unsure: command.tele.reading.unsure,
      scope: command.tele.reading.scope,
      assumed: command.tele.reading.assumed,
      surface: command.tele.surface ?? null,
      level: activeLevel.value,
      recent: command.id.startsWith('data:nl:recent:'),
    })
  }

  if (command.feedback) {
    runWithFeedback(command)
    return
  }

  if (command.stayOpen) {
    // Its own rows show what happens next, so the selection follows the list again.
    navigated.value = false
    command.run?.()
    return
  }

  hide()
  command.run?.()
}

function openChildren(command: CmdCommand) {
  if (command.disabled || !command.children) return
  navDirection.value = 'forward'
  pages.value = [...pages.value, command]
  query.value = ''
  focusInput()
}

let visibleFrame: number | undefined

/** Scrolls `id` into view. Reading scroll metrics forces a layout, so it runs once per frame, before paint. */
function ensureVisible(id: string) {
  if (visibleFrame !== undefined) cancelAnimationFrame(visibleFrame)
  visibleFrame = requestAnimationFrame(() => {
    visibleFrame = undefined
    const container = containerProps.ref.value
    const rowIndex = rows.value.findIndex((row) => row.kind === 'command' && row.command.id === id)
    if (!container || rowIndex === -1) return

    // Keep the section header above the first row in view.
    const top = (rowIndex > 0 && rows.value[rowIndex - 1].kind === 'section' ? rowIndex - 1 : rowIndex) * ROW_HEIGHT
    const bottom = (rowIndex + 1) * ROW_HEIGHT
    if (top < container.scrollTop) container.scrollTop = top
    else if (bottom > container.scrollTop + container.clientHeight) container.scrollTop = bottom - container.clientHeight
  })
}

function moveSelection(step: number) {
  const ids = selectableIds.value
  if (!ids.length) return

  const index = selectedId.value ? ids.indexOf(selectedId.value) : -1
  navigated.value = true
  pendingEnterId.value = undefined
  selectedId.value = ids[(index + step + ids.length) % ids.length]
  ensureVisible(selectedId.value)
}

function hoverRow(id: string) {
  navigated.value = true
  selectedId.value = id
}

function goBack() {
  navDirection.value = 'back'
  if (pages.value.length) {
    pages.value = pages.value.slice(0, -1)
  } else if (activeContext.value) {
    dismissedLevels.value++
  }
}

function onEditKeydown(e: KeyboardEvent) {
  if (e.isComposing) return

  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    cancelEdit()
  } else if (e.key === 'Enter' && !(editing.value?.edit?.multiline && e.shiftKey)) {
    e.preventDefault()
    saveEdit()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.isComposing) return

  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      moveSelection(1)
      return
    case 'ArrowUp':
      e.preventDefault()
      moveSelection(-1)
      return
    case 'Enter': {
      e.preventDefault()
      // A dialog the command opens (GeneralDeleteModal confirms on window Enter) must not get this key.
      e.stopPropagation()
      // Typed faster than the debounce: rank the current query now and take its first row.
      // A row the user arrowed or hovered to stays picked if the new ranking still has it.
      if (debouncedQuery.value !== query.value) {
        debouncedQuery.value = query.value
        if (!navigated.value || !selectedId.value || !selectableIds.value.includes(selectedId.value)) {
          navigated.value = false
          selectedId.value = defaultSelectedId()
        }
      }
      const selectedIndex = results.value.findIndex((c) => c.id === selectedId.value)
      // The leading reading is still loading (so not selectable): wait for it only while the selection is
      // still the default row below it. A row the user arrowed or hovered to runs as picked.
      const lead = readingRows.value[0]
      const isDefaultSelection = !navigated.value || selectedIndex < 0
      if (lead?.loading && isDefaultSelection && (selectedIndex < 0 || results.value.indexOf(lead) < selectedIndex)) {
        pendingEnterId.value = lead.id
        return
      }
      const command = results.value[selectedIndex]
      if (command) execute(command)
      return
    }
    case 'Escape':
      e.preventDefault()
      // Closing the palette must not also close what's under it (an expanded form closes on Esc).
      e.stopPropagation()
      if (aiRow.value?.loading && aiRow.value.cancel) {
        aiRow.value.cancel()
        return
      }
      // In a submenu (or a chip's choices), Esc goes back a level, as it does from an editor.
      if (pages.value.length) {
        goBack()
        focusInput()
        return
      }
      hide()
      return
    case 'Backspace':
      if (query.value) return
      e.preventDefault()
      goBack()
      return
    case 'ArrowRight': {
      const input = e.target as HTMLInputElement
      // A row that runs on Enter opens its children on → (with the caret at the end of the input).
      const selected = results.value.find((c) => c.id === selectedId.value)
      if (selected?.runFirst && selected.children && input.selectionStart === query.value.length) {
        e.preventDefault()
        openChildren(selected)
        return
      }
      // At the end of the input, → accepts the first completion ("industry is manu" → "manufacturing").
      const complete = firstCompletion.value?.complete ?? shownChips.value.ghost?.complete
      if (complete === undefined || input.selectionStart !== query.value.length) return
      e.preventDefault()
      trackSuggestion(firstCompletion.value, 'arrow', !firstCompletion.value)
      applyQuery(complete)
      return
    }
    case 'Tab': {
      e.preventDefault()
      if (activePage.value) return
      const selected = results.value.find((c) => c.id === selectedId.value)
      if (selected?.complete !== undefined) {
        trackSuggestion(selected, 'tab')
        applyQuery(selected.complete)
        return
      }
      // Several readings: Tab moves to the next one (its chips show which).
      const readings = readingRows.value.filter((c) => !c.disabled || c.loading)
      if (readings.length > 1) {
        const index = readings.findIndex((c) => c.id === selectedId.value)
        navigated.value = true
        selectedId.value = readings[(index + 1) % readings.length]!.id
        ensureVisible(selectedId.value)
        return
      }
      if (firstCompletion.value) {
        trackSuggestion(firstCompletion.value, 'tab')
        applyQuery(firstCompletion.value.complete!)
        return
      }
      if (shownChips.value.ghost) {
        trackSuggestion(undefined, 'tab', true)
        applyQuery(shownChips.value.ghost.complete)
        return
      }
      // A plan without AI chat: Tab opens the same upgrade prompt as the fallback row.
      if (aiRow.value?.upgradeFeature) {
        hide()
        aiRow.value.run?.()
        return
      }
      if (!isAiAvailable.value || aiRow.value?.disabled) return
      $e('c:command-palette:ai:ask', {
        level: activeLevel.value,
        // Why the query went to the AI: nothing read it, the reading was unsure, or Tab was just pressed.
        reason: !readingRows.value.length ? 'no-reading' : nlTop?.reading.unsure ? 'unsure' : 'tab',
      })
      // An AI row that answers in the palette keeps it open; otherwise it runs like a pick.
      if (aiRow.value?.stayOpen) {
        navigated.value = false
        aiRow.value.run?.()
        return
      }
      hide()
      if (aiRow.value?.run) aiRow.value.run()
      else askAi(query.value)
      return
    }
  }

  // Cmd+L / Cmd+J open the other palettes from their own window listeners.
  if (cmdOrCtrl && ['l', 'j'].includes(e.key.toLowerCase())) {
    hide()
    return
  }

  if (activePage.value && !query.value && /^[1-9]$/.test(e.key) && !cmdOrCtrl && !e.altKey) {
    const command = results.value[Number(e.key) - 1]
    if (command) {
      e.preventDefault()
      execute(command)
    }
  }
}

function shortcutIndex(command: CmdCommand) {
  if (!activePage.value) return
  const index = results.value.indexOf(command)
  return index >= 0 && index < 9 ? String(index + 1) : undefined
}

function statusOf(command: CmdCommand) {
  return rowStatus.value?.id === command.id ? rowStatus.value : undefined
}

// Also opened by `setActiveCmdView`, which sets the v-model directly.
watch(vOpen, (isOpen) => {
  if (!isOpen) {
    clearTimeout(closeTimer)
    return
  }
  if (!user.value || activeScope.value.scope === 'disabled') {
    vOpen.value = false
    return
  }

  loadScope()
  query.value = ''
  debouncedQuery.value = ''
  navigated.value = false
  selectedId.value = undefined
  pages.value = []
  dismissedLevels.value = 0
  editing.value = undefined
  isSaved.value = false
  rowStatus.value = undefined
  isRunning = false
  // In the first frame, so the focus reuses the layout the first paint needs instead of forcing one.
  requestAnimationFrame(() => inputEl.value?.focus())
})

watch([query, vOpen], () => (pendingEnterId.value = undefined))

// The reading Enter waited for has settled: run it, or select it so its hint says why it can't.
watch(results, (list) => {
  if (!pendingEnterId.value) return
  const row = list.find((c) => c.id === pendingEnterId.value)
  if (row?.loading) return
  pendingEnterId.value = undefined
  if (!row) return
  if (!row.disabled) return execute(row)
  navigated.value = true
  selectedId.value = row.id
})

// Typing or moving on clears a stale result; a pending one stays until it settles.
watch([query, selectedId], () => {
  if (rowStatus.value && rowStatus.value.kind !== 'pending' && rowStatus.value.id !== selectedId.value) {
    rowStatus.value = undefined
  }
})

watch([debouncedQuery, () => pages.value.length, activeLevel], () => {
  if (!vOpen.value) return
  navigated.value = false
  selectedId.value = defaultSelectedId()
  // Known from the scroll event, so a new query doesn't force a layout just to check it.
  if (scrolledAway) containerProps.ref.value?.scrollTo({ top: 0 })
  // The first row is in view at the top; only a submenu opening on its current value may need scrolling.
  if (selectedId.value && selectedId.value !== selectableIds.value[0]) ensureVisible(selectedId.value)
})

// Providers that mount late (toolbar, submenus loading) keep the first row selected until the user navigates.
watch(selectableIds, (ids) => {
  if (!vOpen.value) return
  if (!navigated.value || !selectedId.value || !ids.includes(selectedId.value)) selectedId.value = defaultSelectedId()
})

watch(editValue, () => {
  editError.value = undefined
})

defineExpose({
  open: show,
  close: hide,
})
</script>

<template>
  <CmdKShell v-model:open="vOpen" active-cmd="cmd-k" :set-active-cmd-view="setActiveCmdView">
    <template #header>
      <div v-if="activeContext || breadcrumbs.length" class="flex items-center gap-1.5 px-4 pt-3 min-w-0">
        <Transition name="nc-cmdk-pop" mode="out-in">
          <div
            v-if="activeContext"
            :key="activeContext.level"
            class="nc-cmdk-context-chip flex items-center gap-1.5 h-6 pl-2 pr-1 rounded-md border-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight text-bodySm text-nc-content-gray-subtle min-w-0"
            data-testid="nc-cmdk-context-chip"
          >
            <CmdKItemIcon v-if="activeContext.context.icon" :icon="activeContext.context.icon" class="flex-none" />
            <span v-if="activeContext.context.prefix" class="text-nc-content-gray-muted truncate max-w-32 flex-none">
              {{ activeContext.context.prefix }}
            </span>
            <GeneralIcon
              v-if="activeContext.context.prefix"
              icon="ncChevronRight"
              class="h-3 w-3 text-nc-content-gray-muted flex-none"
            />
            <NcTooltip show-on-truncate-only class="truncate max-w-64" :tooltip-style="{ zIndex: 1100 }">
              <template #title>{{ activeContext.context.label }}</template>
              {{ activeContext.context.label }}
            </NcTooltip>
            <NcTooltip :title="$t('labels.commandPalette.removeContext')" :tooltip-style="{ zIndex: 1100 }">
              <div
                class="flex items-center justify-center h-4 w-4 rounded cursor-pointer text-nc-content-gray-muted hover:(bg-nc-bg-gray-medium text-nc-content-gray)"
                @click="goBack()"
              >
                <GeneralIcon icon="ncX" class="h-3 w-3" />
              </div>
            </NcTooltip>
          </div>
        </Transition>
        <template v-for="crumb of breadcrumbs" :key="crumb.id">
          <GeneralIcon icon="ncChevronRight" class="h-3.5 w-3.5 text-nc-content-gray-muted flex-none" />
          <span class="text-bodySm text-nc-content-gray-subtle truncate">{{ crumb.title.replace(/…$/, '') }}</span>
        </template>
      </div>

      <!-- Multiline edits are a compose area in the body; the header keeps only the chip row. -->
      <div v-if="editing?.edit?.multiline" class="pb-3" />
      <div v-else-if="editing?.edit" class="nc-cmdk-input-row">
        <GeneralIcon icon="ncEdit" class="nc-cmdk-input-icon" />
        <input
          ref="inputEl"
          v-model="editValue"
          class="cmdk-input"
          type="text"
          data-testid="nc-cmdk-edit-input"
          :placeholder="editing.edit.placeholder || editing.title.replace(/…$/, '')"
          :aria-label="editing.title.replace(/…$/, '')"
          :disabled="isSaving"
          @keydown="onEditKeydown"
        />
        <GeneralLoader v-if="isSaving" />
      </div>
      <div v-else class="nc-cmdk-input-row">
        <GeneralIcon class="nc-cmdk-input-icon" icon="search" />
        <input
          ref="inputEl"
          v-model="query"
          class="cmdk-input"
          type="text"
          data-testid="nc-cmdk-input"
          :placeholder="activePage ? activePage.title : $t('labels.commandPalette.placeholder')"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="!!rows.length"
          aria-controls="nc-cmdk-listbox"
          :aria-activedescendant="selectedId ? cmdRowDomId(selectedId) : undefined"
          @keydown="onKeydown"
        />
        <GeneralLoader v-if="cmdLoading && isSearching" />
        <div
          v-if="!activePage && isSearching && (readingRows.length > 1 || firstCompletion)"
          class="flex items-center gap-1.5 text-bodySm text-nc-content-gray-muted flex-none"
          data-testid="nc-cmdk-tab-hint"
        >
          {{ readingRows.length > 1 ? $t('labels.commandPalette.nl.nextReading') : $t('labels.commandPalette.nl.complete') }}
          <GeneralShortcutLabel :keys="['Tab']" />
        </div>
        <div
          v-else-if="isAiAvailable && !activePage && !aiRow && !firstCompletion"
          class="flex items-center gap-1.5 text-bodySm text-nc-content-gray-muted flex-none cursor-pointer hover:text-nc-content-gray"
          @click="askAi(query)"
        >
          <GeneralIcon icon="ncAutoAwesome" class="h-3.5 w-3.5" />
          {{ $t('labels.commandPalette.askAi') }}
          <GeneralShortcutLabel :keys="['Tab']" />
        </div>
      </div>
      <!-- How the selected reading understood the query; a chip with alternatives opens them. -->
      <div
        v-if="!editing && !activePage && (shownChips.chips.length || shownChips.ghost)"
        class="nc-cmdk-chips flex items-center gap-1 flex-wrap px-4 pb-2.5 -mt-1"
        :class="{ 'nc-cmdk-chips--tentative': shownChips.tentative }"
        data-testid="nc-cmdk-reading-chips"
        :data-tentative="shownChips.tentative || undefined"
      >
        <NcTooltip
          v-for="(chip, i) of shownChips.chips"
          :key="chip.key ?? `${chip.kind}:${i}`"
          :disabled="!chip.tooltip"
          :title="chip.tooltip"
          :tooltip-style="{ zIndex: 1100 }"
          class="flex min-w-0"
        >
          <component
            :is="chip.swaps?.length ? 'button' : 'span'"
            class="nc-cmdk-chip"
            :class="[`nc-cmdk-chip--${chip.kind}`, { 'nc-cmdk-chip--swappable': chip.swaps?.length }]"
            :data-testid="`nc-cmdk-chip-${chip.kind}`"
            :type="chip.swaps?.length ? 'button' : undefined"
            @click="openChip(chip, i)"
          >
            <CmdKItemIcon v-if="chip.icon" :icon="chip.icon" class="flex-none" />
            <span class="truncate" :class="chip.kind === 'assumed' ? 'max-w-64' : 'max-w-40'">{{ chip.text }}</span>
            <span v-if="chip.kind === 'assumed' && !chip.plain" class="nc-cmdk-chip-assumed flex-none">
              {{ $t('labels.commandPalette.nl.assumed') }}
            </span>
            <GeneralIcon v-if="chip.swaps?.length" icon="ncChevronDown" class="h-3 w-3 flex-none opacity-60" />
          </component>
        </NcTooltip>
        <!-- The field name being typed, completed: Tab or → accepts it. -->
        <button
          v-if="shownChips.ghost"
          key="ghost"
          type="button"
          class="nc-cmdk-chip nc-cmdk-chip--field nc-cmdk-chip--ghost"
          data-testid="nc-cmdk-chip-ghost"
          @click="applyQuery(shownChips.ghost.complete)"
        >
          <CmdKItemIcon v-if="shownChips.ghost.icon" :icon="shownChips.ghost.icon" class="flex-none" />
          <span class="truncate max-w-40">{{ shownChips.ghost.text }}</span>
          <GeneralShortcutLabel :keys="['Tab']" class="nc-cmdk-chip-key" />
        </button>
      </div>
    </template>

    <Transition :name="`nc-cmdk-slide-${navDirection}`" mode="out-in">
      <div
        v-if="editing?.edit"
        key="edit"
        class="nc-cmdk-edit-body"
        :class="{ 'nc-cmdk-edit-body--multiline': editing.edit.multiline }"
      >
        <div v-if="editing.edit.multiline" class="nc-cmdk-compose">
          <textarea
            ref="inputEl"
            v-model="editValue"
            class="cmdk-input nc-cmdk-textarea nc-scrollbar-thin"
            data-testid="nc-cmdk-edit-input"
            :placeholder="editing.edit.placeholder || editing.title.replace(/…$/, '')"
            :aria-label="editing.title.replace(/…$/, '')"
            :disabled="isSaving"
            @keydown="onEditKeydown"
          />
          <GeneralLoader v-if="isSaving" class="flex-none" />
        </div>
        <Transition name="nc-cmdk-pop">
          <div v-if="isSaved" class="flex items-center gap-2 text-bodySm text-nc-content-brand" data-testid="nc-cmdk-edit-saved">
            <GeneralIcon icon="ncCheck" class="h-4 w-4 flex-none" />
            {{ editing.feedback ?? $t('labels.commandPalette.saved') }}
          </div>
        </Transition>
        <div v-if="!isSaved && editError" class="flex items-center gap-2 text-bodySm text-nc-content-red-medium">
          <GeneralIcon icon="ncAlertCircle" class="h-4 w-4 flex-none" />
          {{ editError }}
        </div>
        <div v-if="!isSaved" class="flex items-center gap-3 text-bodySm text-nc-content-gray-muted">
          <span class="flex items-center gap-1">
            <GeneralShortcutLabel :keys="['Enter']" />
            {{ $t('general.save') }}
          </span>
          <span v-if="editing.edit.multiline" class="flex items-center gap-1">
            <GeneralShortcutLabel :keys="['Shift', 'Enter']" />
            {{ $t('labels.commandPalette.newLine') }}
          </span>
          <span class="flex items-center gap-1">
            <GeneralShortcutLabel :keys="['Esc']" />
            {{ $t('general.cancel') }}
          </span>
        </div>
      </div>

      <div v-else :key="`page-${pages.length}`" class="cmdk-body">
        <div v-if="!rows.length" class="nc-cmdk-empty">
          <GeneralLoader v-if="cmdLoading" :size="24" />
          <template v-else>
            <GeneralIcon icon="search" class="h-6 w-6 text-nc-content-gray-muted" />
            <div class="text-body text-nc-content-gray">{{ $t('placeholder.noResultsFoundForYourSearch') }}</div>
            <div v-if="isAiAvailable && query" class="flex items-center gap-1.5 text-bodySm text-nc-content-gray-muted">
              {{ $t('labels.commandPalette.askAi') }}
              <GeneralShortcutLabel :keys="['Tab']" />
            </div>
          </template>
        </div>
        <div v-else v-bind="containerProps" class="cmdk-actions nc-scrollbar-thin">
          <div id="nc-cmdk-listbox" v-bind="wrapperProps" role="listbox">
            <template v-for="item in list" :key="item.index">
              <div
                v-if="item.data.kind === 'section'"
                class="nc-cmdk-section"
                role="presentation"
                :style="{ height: `${ROW_HEIGHT}px` }"
              >
                {{ item.data.title }}
              </div>
              <CmdKRow
                v-else
                :command="item.data.command"
                :selected="selectedId === item.data.command.id"
                :height="ROW_HEIGHT"
                :status="statusOf(item.data.command)"
                :index-key="shortcutIndex(item.data.command)"
                @hover="hoverRow(item.data.command.id)"
                @select="execute(item.data.command)"
                @open="openChildren(item.data.command)"
              />
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </CmdKShell>
</template>
