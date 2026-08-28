<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import Draggable from 'vuedraggable'
import tinycolor from 'tinycolor2'
import { type ColumnType, type InterfaceKanbanVizTheme, PermissionEntity, PermissionKey, UITypes, isVirtualCol } from 'nocodb-sdk'
import type { Row as RowType } from '#imports'

interface Attachment {
  url: string
}

const INFINITY_SCROLL_THRESHOLD = 100

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

// useProvideKanbanViewStore(meta, view)

const reloadViewDataHook = inject(ReloadViewDataHookInj)

const reloadViewMetaHook = inject(ReloadViewMetaHookInj)

const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())

const isLocked = inject(IsLockedInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

// Interface pages open their record-detail sheet instead of the expanded form.
const interfaceExpandRecord = inject(InterfaceExpandRecordInj, undefined)

// Interface pages route the "+ New record" affordances through the configured
// record form / create card (mirrors the calendar viz) rather than the classic
// expanded-record form, which was intentionally removed on interface pages.
const interfaceNewRecordForm = inject(InterfaceNewRecordFormInj, ref<((prefill: Record<string, any>) => boolean) | null>(null))

const expandedFormDlg = ref(false)

const expandedFormRow = ref<RowType>()

const expandedFormRowState = ref<Record<string, any>>()

provide(RowHeightInj, ref(1 as const))

const deleteStackVModel = ref(false)

const stackToBeDeleted = ref('')

const stackIdxToBeDeleted = ref(0)

const router = useRouter()

const route = router.currentRoute

const { isDark, getColor } = useTheme()

const { metaColumnById } = useViewColumnsOrThrow(view, meta)

const { isSyncedTable, eventBus } = useSmartsheetStoreOrThrow()

const { copy } = useCopy()

const { t } = useI18n()

const { isMounted } = useIsMounted()

const {
  loadKanbanData,
  loadKanbanDataForStacks,
  useWindowedKanbanLoad,
  loadMoreKanbanData,
  kanbanMetaData,
  formattedData,
  updateOrSaveRow,
  addEmptyRow,
  groupingFieldColOptions,
  groupingField,
  stackMetaObj,
  groupingFieldColumn,
  countByStack,
  deleteStack,
  updateKanbanMeta,
  shouldScrollToRight,
  deleteRow,
  addNewStackId,
  removeRowFromUncategorizedStack,
  uncategorizedStackId,
  updateStackProperty,
  updateAllStacksProperty,
} = useKanbanViewStoreOrThrow()

const { isViewDataLoading, isActiveViewFieldHeaderVisible } = storeToRefs(useViewsStore())

const { isUIAllowed } = useRoles()

const { appInfo, isMobileMode } = useGlobal()

const { showRecordPlanLimitExceededModal } = useEeConfig()

const { withLoading } = useLoadingTrigger()

provide(IsFormInj, ref(false))

provide(IsGalleryInj, ref(false))

provide(IsGridInj, ref(false))

provide(IsKanbanInj, ref(true))

const interfacePageDataApi = inject(InterfacePageDataInj, undefined)

// Whether the interface viz opens records — gates the context-menu Expand item.
const interfaceClickIntoDetails = inject(InterfaceClickIntoDetailsInj, ref(true))

// Pointer affordance — cards drop the pointer cursor when a click neither
// opens the record nor (builder) prompts to enable click-into-details.
const interfaceShowRowExpand = inject(InterfaceShowRowExpandInj, ref(true))

const isReadonly = inject(ReadonlyInj, ref(false))

const hasEditPermission = computed(
  () =>
    isUIAllowed('dataEdit') &&
    (!interfacePageDataApi || !isReadonly.value) &&
    (!isSyncedTable.value || !groupingFieldColumn.value?.readonly),
)

/** Interface pages gate add/delete on the viz opt-in (legacy Kanban parity). */
const canAddDeleteRows = computed(
  () => isUIAllowed('dataEdit') && (!interfacePageDataApi || interfacePageDataApi.canAddDeleteInline.value),
)

const fields = inject(FieldsInj, ref([]))

const fieldsWithoutDisplay = computed(() => fields.value.filter((f) => !isPrimary(f)))

// Interface boards get FLIP drag animation (cards part to make room)
/**
 * Kanban surface theme (interface pages only). `board` — the default and the
 * data-app look — fills cards with the record color; the other themes keep a
 * neutral card surface and surface the raw record color instead.
 */
const interfaceKanbanTheme = inject(InterfaceKanbanThemeInj, undefined)

// Resolved card theme — `board` outside interface pages keeps the data-app
// treatment untouched. Surface-only: never fields, ordering or color meaning.
const kanbanCardTheme = computed<InterfaceKanbanVizTheme>(() =>
  interfacePageDataApi ? interfaceKanbanTheme?.value ?? 'board' : 'board',
)

// columns/compact swap the record-color fill/left bar for an 8px dot before
// the display value.
const showRecordColorDot = computed(() => kanbanCardTheme.value === 'columns' || kanbanCardTheme.value === 'compact')

const cardBodyPadding = computed(() => {
  if (!interfacePageDataApi) return '12px !important'

  return kanbanCardTheme.value === 'compact' ? '4px 8px !important' : '8px !important'
})

const displayField = computed(() => meta.value?.columns?.find((c) => c.pv && fields.value.includes(c)) ?? null)

// Card-title tooltip is only meaningful for non-virtual text / number display values (the ones that overflow).
const isDisplayFieldTextOrNumber = computed(() => isTextOrNumberColumn(displayField.value))

const coverImageColumn: any = computed(() =>
  meta.value?.columnsById
    ? meta.value.columnsById[kanbanMetaData.value?.fk_cover_image_col_id as keyof typeof meta.value.columnsById]
    : {},
)

const coverImageObjectFitStyle = computed(() => {
  const fk_cover_image_object_fit = parseProp(kanbanMetaData.value?.meta)?.fk_cover_image_object_fit || CoverImageObjectFit.FIT

  if (fk_cover_image_object_fit === CoverImageObjectFit.FIT) return 'contain'
  if (fk_cover_image_object_fit === CoverImageObjectFit.COVER) return 'cover'
})

const isRequiredGroupingFieldColumn = computed(() => {
  return !!groupingFieldColumn.value?.rqd
})

const isColorCodeEnabled = computed(() => parseProp(groupingFieldColumn.value?.meta)?.isColorCodeEnabled !== false)

const {
  isRowColouringEnabled,
  getCellColorStyle: _getCellColorStyle,
  getCellLeftBorderStyle: _getCellLeftBorderStyle,
} = useViewRowColorRender()

const getCellColorStyle = (record: Row, columnId: string) => {
  // Access pre-computed cell colors from rowMeta (optimized - no function calls)
  const cellColorInfo = record.rowMeta?.cellColors?.[columnId]
  if (!cellColorInfo) return {}

  const style: Record<string, string> = {}
  if (cellColorInfo.cellBgColor) {
    style.backgroundColor = cellColorInfo.cellBgColor
  }
  return style
}

const getCellLeftBorderStyle = (record: Row, columnId: string) => {
  // Access pre-computed cell colors from rowMeta (optimized - no function calls)
  const cellColorInfo = record.rowMeta?.cellColors?.[columnId]
  if (!cellColorInfo || cellColorInfo.is_set_as_background || !cellColorInfo.cellLeftBorderColor) return null

  return { backgroundColor: cellColorInfo.cellLeftBorderColor }
}

const getCellColorClass = (record: Row, columnId: string) => {
  const bgStyle = getCellColorStyle(record, columnId)
  return bgStyle?.backgroundColor ? 'has-cell-bg-color' : ''
}

const getCellColorBgVar = (record: Row, columnId: string) => {
  const bgStyle = getCellColorStyle(record, columnId)
  return bgStyle?.backgroundColor ? { '--cell-bg-color': bgStyle.backgroundColor } : {}
}

// The row-color left bar stays for the fill/wash themes (board/tint); the dot
// themes (columns/compact) replace it with the display-value dot.
const showRecordColorLeftBar = computed(() => isRowColouringEnabled.value && !showRecordColorDot.value)

function getCardColorStyle(record: RowType): Record<string, string> {
  const colorStyle = extractRowBackgroundColorStyle(record)

  if (kanbanCardTheme.value === 'board') {
    return { ...colorStyle.rowBgColor, ...colorStyle.rowBorderColor }
  }

  // Non-fill themes keep the neutral card surface — the raw record color is
  // handed to the host CSS (tint wash / accent bar) via a custom property.
  const rawColor = record.rowMeta?.rowLeftBorderColor

  return rawColor ? { '--nc-record-color': rawColor } : {}
}

const kanbanContainerRef = ref()

const selectedStackTitle = ref('')

// Horizontal virtual scrolling for stacks
const STACK_WIDTH = 274 // w-68.5 = 274px (17.125rem * 16)
const STACK_GAP = 12 // gap-3 = 12px
const STACK_WIDTH_WITH_GAP = STACK_WIDTH + STACK_GAP

const horizontalScrollLeft = ref(0)
const horizontalContainerWidth = ref(0)

// Tracks a card being dragged anywhere on the kanban — used to enable hover-to-expand on collapsed
// stacks and to force every stack to render so off-screen stacks remain valid drop targets.
const isCardDragInProgress = ref(false)

// Tracks a stack being reordered — forces every stack to render so a stack can be dropped at a
// position currently held by an off-screen (not-yet-rendered) stack.
const isStackDragInProgress = ref(false)

// Frozen render window for the duration of a card drag. Sortable breaks if stacks mount/unmount
// mid-drag (the drag silently fails to complete), so on drag start we pin a bounded span of stacks
// and keep it fixed until drop — the user can auto-scroll and drop anywhere within it.
const cardDragWindow = ref<{ start: number; end: number } | null>(null)

// Same idea for a stack reorder: freeze the rendered window at drag start so the set of stacks
// Sortable is tracking can't shift while auto-scrolling, and the relative→absolute index mapping in
// onMoveStack stays stable for the whole drag.
const stackDragWindow = ref<{ start: number; end: number } | null>(null)

// How many stacks to keep rendered during a card drag. Large enough to cover a long auto-scroll,
// bounded so drag start doesn't mount thousands of columns on a high-cardinality board.
const CARD_DRAG_SPAN = 120

// Window span for a stack reorder. Each rendered stack also renders its card list, so keep this
// tighter than the card-drag span to bound the work when reordering on a high-cardinality board.
const STACK_DRAG_SPAN = 60

// A card drop persists the moved row asynchronously (onMove → updateOrSaveRow). We hold that promise
// so drag end can wait for the write to commit before reloading.
const pendingCardMove = ref<Promise<unknown> | null>(null)

// The last cross-stack card move (source, target, row), captured across the two separate `change`
// events sortable fires (removed on the source list, added on the target list). Used by drag end to
// reconcile the move into the reloaded data — the grouped-data read can briefly lag a just-committed
// write, so a reload may return the target without this row (or the source still holding it).
const lastCardMove = ref<{ row: any; fromKey: string | null; toKey: string | null }>({
  row: null,
  fromKey: null,
  toKey: null,
})

// Track which stacks are visible horizontally
const stackSlice = reactive({
  start: 0,
  end: 0,
})

// Calculate horizontal stack visibility
const calculateStackSlice = () => {
  if (!kanbanContainerRef.value) {
    setTimeout(calculateStackSlice, 50)
    return
  }

  const containerWidth = kanbanContainerRef.value.clientWidth
  horizontalContainerWidth.value = containerWidth

  if (containerWidth === 0) {
    // Set initial slice if container not ready
    if (stackSlice.end === 0 && groupingFieldColOptions.value.length > 0) {
      const initialVisibleCount = Math.ceil(800 / STACK_WIDTH_WITH_GAP) + 2 // Show ~3 stacks initially
      stackSlice.start = 0
      stackSlice.end = Math.min(initialVisibleCount, groupingFieldColOptions.value.length)
    }
    return
  }

  const scrollLeft = kanbanContainerRef.value.scrollLeft
  horizontalScrollLeft.value = scrollLeft

  // Calculate which stacks are visible based on scroll position
  // The container has padding (p-3 = 12px on left side)
  const padding = 12
  // Scroll position relative to content (accounting for padding)
  const contentScrollLeft = Math.max(0, scrollLeft - padding)
  const visibleWidth = containerWidth - padding

  // Calculate start index - each stack takes STACK_WIDTH, with STACK_GAP between them
  // In flexbox with gap-3, the gap is automatically added between items
  // So the effective width per stack is STACK_WIDTH + STACK_GAP
  const startIndex = Math.max(0, Math.floor(contentScrollLeft / STACK_WIDTH_WITH_GAP))

  // Calculate how many stacks fit in the visible area
  // Add 1 to ensure we include partially visible stacks
  const visibleCount = Math.ceil(visibleWidth / STACK_WIDTH_WITH_GAP) + 1
  const endIndex = Math.min(startIndex + visibleCount, groupingFieldColOptions.value.length)

  // Add buffer stacks for smooth scrolling
  const BUFFER_STACKS = 2
  const newStart = Math.max(0, startIndex - BUFFER_STACKS)
  const newEnd = Math.min(groupingFieldColOptions.value.length, endIndex + BUFFER_STACKS)

  // Only update if changed
  if (stackSlice.start !== newStart || stackSlice.end !== newEnd) {
    stackSlice.start = newStart
    stackSlice.end = newEnd
  }
}

// The window of stacks actually rendered. Only this slice is passed to the Draggable; everything
// outside it is represented by left/right spacer divs that preserve scroll width. This keeps the
// stack v-for at ~window-size iterations instead of O(total stacks) on every render — without it a
// board grouped by a high-cardinality field (e.g. a SingleSelect with thousands of options) freezes.
const stackWindow = computed(() => {
  const total = groupingFieldColOptions.value.length
  if (!total) return { start: 0, end: 0 }

  // While a card or stack drag is in progress, return the window frozen at drag start so nothing
  // mounts/unmounts mid-drag (Sortable silently fails to complete the drop otherwise).
  const frozen = cardDragWindow.value ?? stackDragWindow.value
  if (frozen) {
    return {
      start: Math.max(0, Math.min(frozen.start, total)),
      end: Math.max(0, Math.min(frozen.end, total)),
    }
  }

  let start: number
  let end: number

  if (!stackSlice.end) {
    // Slice not calculated yet — show the first few stacks
    start = 0
    end = Math.min(total, 6)
  } else {
    const EXTRA_BUFFER = 1
    start = Math.max(0, stackSlice.start - EXTRA_BUFFER)
    end = Math.min(total, stackSlice.end + EXTRA_BUFFER)
  }

  return { start, end }
})

// Sliced copy passed to the stack Draggable. vuedraggable mutates this array in place on reorder,
// but that mutation is transient: onMoveStack rebuilds groupingFieldColOptions, which recomputes
// this slice on the next tick, so the in-place change is never the source of truth.
const visibleStackOptions = computed(() => groupingFieldColOptions.value.slice(stackWindow.value.start, stackWindow.value.end))

// Spacer widths approximate off-screen stacks at a uniform width (matching calculateStackSlice's
// assumption). Collapsed/hidden stacks make this slightly imprecise, but it keeps the horizontal
// scrollbar proportional, which is all that matters for high stack counts.
const leftStackSpacerWidth = computed(() => stackWindow.value.start * STACK_WIDTH_WITH_GAP)

const rightStackSpacerWidth = computed(
  () => Math.max(0, groupingFieldColOptions.value.length - stackWindow.value.end) * STACK_WIDTH_WITH_GAP,
)

// Map a Draggable slot index (relative to the rendered window) back to the absolute index into
// groupingFieldColOptions, which the stack mutation handlers rely on.
const getAbsStackIdx = (relIndex: number) => stackWindow.value.start + relIndex

// Load grouped data one visible window at a time so high-cardinality boards don't fetch every stack
// upfront. Public/shared views keep the original full load (the shared-view endpoint can't filter
// groups), so windowed mode is enabled only for non-public boards. Interface pages ride the
// InterfacePageDataInj adapter, which carries the same per-window restriction (`stackTitles`) —
// including public interface shares, which reach the adapter rather than the shared-view endpoint
// (`VizWrapper` provides `IsPublicInj = false` for every interface mount).
useWindowedKanbanLoad.value = !isPublic.value

const currentWindowStackTitles = () => visibleStackOptions.value.map((stack) => stack.title ?? null)

const loadVisibleStacks = async (reset = false) => {
  if (!useWindowedKanbanLoad.value) {
    await loadKanbanData()
    return
  }

  try {
    await loadKanbanDataForStacks(currentWindowStackTitles(), { reset })
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

// Fetch the data for stacks scrolled into view. Debounced so fast horizontal scrolling doesn't fire
// a request per intermediate window — loadKanbanDataForStacks already skips already-loaded stacks.
const debouncedLoadVisibleStacks = useDebounceFn(() => loadVisibleStacks(), 100)

watch(visibleStackOptions, () => {
  if (!useWindowedKanbanLoad.value) return

  // Never load while a drag is in progress: replacing formattedData mid-drag re-renders the card
  // lists and destroys the DOM nodes Sortable is tracking, which breaks the drag entirely. Stacks
  // scrolled into view during a drag still render an empty Draggable (valid drop target); their real
  // data is loaded on drag end.
  if (isCardDragInProgress.value || isStackDragInProgress.value) return

  debouncedLoadVisibleStacks()
})

// Field height mapping for card height calculation
const FIELD_HEIGHT = {
  [UITypes.LongText]: 150,
  [UITypes.Attachment]: 56,
  default: 44,
}

// Calculate card height dynamically based on fields and cover image
const cardHeight = computed(() => {
  // Calculate cardHeight in pixels from the FIELD_HEIGHT map and if the card has cover image
  // 208 px for Card Image Height (h-52 = 208px)
  // 32 px for displayField (text-xl leading-8)
  // 16 px padding top and bottom (12px padding = 24px total, but we use 16px for each side)
  // 12 px gap between each field
  // 4 px for card padding (py-1 = 4px top + 4px bottom)
  // 2 px for border
  const displayFieldHeight = displayField.value ? 32 + 16 + 12 + 4 + 2 : 16

  const fieldsHeight = fieldsWithoutDisplay.value.reduce((acc, field) => {
    const fieldHeight = FIELD_HEIGHT[field!.uidt!] || FIELD_HEIGHT.default
    return acc + fieldHeight
  }, 0)

  return displayFieldHeight + fieldsHeight + (kanbanMetaData.value?.fk_cover_image_col_id ? 208 : 0) + 4 + 2
})

// Virtual scrolling for vertical cards in each stack
const CARD_VIRTUAL_MARGIN = 0 // No margin for maximum memory efficiency
// Use shallowRef for Maps to reduce reactive dependencies (Maps don't need deep reactivity)
const stackScrollTops = shallowRef<Map<string | null, number>>(new Map())
const stackCardSlices = shallowRef<Map<string | null, { start: number; end: number }>>(new Map())
// Version counter for slice changes - more efficient than hash calculation
const slicesVersion = ref(0)

const reloadViewDataListener = withLoading(async () => {
  // Reset so a filter/search/sort change refetches the current window fresh (and other stacks reload
  // as they scroll back into view).
  await loadVisibleStacks(true)
})

reloadViewDataHook?.on(reloadViewDataListener)

const smartsheetEventHandler = (event: SmartsheetStoreEvents) => {
  if (event === SmartsheetStoreEvents.DATA_RELOAD) {
    reloadViewDataHook?.trigger()
  }
}

eventBus.on(smartsheetEventHandler)

const attachments = (record: any): Attachment[] => {
  if (!coverImageColumn.value?.title || !record.row[coverImageColumn.value.title]) return []

  try {
    const att =
      typeof record.row[coverImageColumn.value.title] === 'string'
        ? JSON.parse(record.row[coverImageColumn.value.title])
        : record.row[coverImageColumn.value.title]

    if (Array.isArray(att)) {
      return att
        .flat()
        .map((a) => (typeof a === 'string' ? JSON.parse(a) : a))
        .filter((a) => a && !Array.isArray(a) && typeof a === 'object' && Object.keys(a).length)
    }

    return []
  } catch (e) {
    return []
  }
}

const reloadAttachments = ref(false)

const reloadViewMetaListener = async () => {
  reloadAttachments.value = true

  nextTick(() => {
    reloadAttachments.value = false
  })
}

reloadViewMetaHook?.on(reloadViewMetaListener)

/** Card picked by an inert click (interface, click-into-details off) — pure visual feedback. */
const selectedCardId = ref<string | null>(null)

function isCardSelected(record: RowType) {
  if (!selectedCardId.value || !meta.value?.columns) return false

  return selectedCardId.value === extractPkFromRow(record.row, meta.value.columns)
}

const expandForm = (row: RowType, state?: Record<string, any>) => {
  if (interfaceExpandRecord?.(row)) {
    // Click-into-details off — the swallowed click still lands visibly by
    // selecting the card.
    if (!interfaceClickIntoDetails.value && !row.rowMeta?.new) {
      selectedCardId.value = extractPkFromRow(row.row, meta.value!.columns!) || null
    }

    return
  }

  const rowId = extractPkFromRow(row.row, meta.value!.columns!)
  expandedFormRowState.value = state
  if (rowId && !isPublic.value) {
    expandedFormRow.value = undefined

    router.push({
      query: {
        ...route.value.query,
        rowId,
      },
    })
  } else {
    expandedFormRow.value = row
    expandedFormDlg.value = true
  }
}

const _contextMenu = ref(false)

const contextMenuTarget = ref<RowType | null>(null)

const contextMenu = computed({
  get: () => _contextMenu.value,
  set: (val) => {
    // Every item is a record operation — a right-click that didn't land on a
    // card (empty stack area) must not open the menu at all: without the
    // capture-phase target reset below it would show the PREVIOUS card's ops.
    if (val && !contextMenuTarget.value) return

    // Interface pages keep the menu for permission-free items (expand, copy URL).
    if (hasEditPermission.value || interfacePageDataApi) {
      _contextMenu.value = val
    }
  },
})

/**
 * Capture-phase reset for every right-click on the board: a card's own
 * @contextmenu (bubble phase) re-sets the target BEFORE ant's dropdown
 * trigger opens the menu, so only card clicks ever have one.
 */
function resetContextMenuTarget() {
  contextMenuTarget.value = null
}

const showSendRecordModal = ref(false)

const contextMenuRowId = computed(() => {
  if (!contextMenuTarget.value) return null
  return extractPkFromRow(contextMenuTarget.value.row, meta.value?.columns)
})

/** Interface-only: duplicate rides the add/delete opt-in like the grid record menu. */
const canDuplicateRow = computed(
  () => !!interfacePageDataApi && canAddDeleteRows.value && isUIAllowed('dataEdit') && !isSyncedTable.value,
)

const showContextMenu = (e: MouseEvent, target?: RowType) => {
  e.preventDefault()
  if (target) {
    contextMenuTarget.value = target
  }
}

/** Interface: duplicate the right-clicked card into its stack, directly below it. */
async function interfaceDuplicateRow() {
  const target = contextMenuTarget.value
  if (!target || !canDuplicateRow.value || !interfacePageDataApi) return

  // Clone the record's values (identity markers + system columns stripped) — the
  // stacking field value rides along, so the copy lands in the same stack. Prompts
  // when the record holds links the copy can't share (null = prompt dismissed).
  const clonedData = await prepareDuplicateRowData(target.row, meta.value?.columns as ColumnType[])
  if (!clonedData) return

  // `before` is the pk of the next card in the source's stack, so the copy
  // lands right below the original (grid/gallery record-menu parity).
  const pk = extractPkFromRow(target.row, meta.value?.columns as ColumnType[])
  let beforeRowId: string | undefined
  for (const rows of formattedData.value.values()) {
    const idx = rows.findIndex((r) => extractPkFromRow(r.row, meta.value?.columns as ColumnType[]) === pk)
    if (idx !== -1) {
      const next = rows[idx + 1]
      beforeRowId = next ? extractPkFromRow(next.row, meta.value?.columns as ColumnType[]) : undefined
      break
    }
  }

  try {
    await interfacePageDataApi.insertRow(clonedData, { before: beforeRowId })
    message.toast(t('msg.success.rowDuplicated'))
    await loadVisibleStacks()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

/** Interface: deep link to this record — the current page URL with its rowId. */
async function interfaceCopyRecordUrl() {
  if (!contextMenuRowId.value) return

  const [origin, hash = ''] = window.location.href.split('#')
  const [hashPath, hashQuery = ''] = hash.split('?')
  const params = new URLSearchParams(hashQuery)
  params.set('rowId', contextMenuRowId.value)

  await copy(`${origin}#${hashPath}?${params.toString()}`)
  message.toast(t('msg.info.copiedToClipboard'))
}

const expandedFormOnRowIdDlg = computed({
  get() {
    return !!route.value.query.rowId
  },
  set(val) {
    if (!val)
      router.push({
        query: {
          ...route.value.query,
          rowId: undefined,
        },
      })
  },
})

const expandFormClick = async (e: MouseEvent, row: RowType) => {
  const target = e.target as HTMLElement
  if (target.closest('.arrow') || target.closest('.slick-dots')) return
  if (e.target as HTMLElement) {
    expandForm(row)
  }
}

/** Block dragging the stack to first index (reserved for uncategorized) **/
function onMoveCallback(event: { draggedContext: { futureIndex: number } }) {
  // futureIndex is relative to the rendered window — map to absolute so we still forbid dropping a
  // stack before the uncategorized stack (absolute index 0).
  if (stackWindow.value.start + event.draggedContext.futureIndex === 0) {
    return false
  }
}

async function onMoveStack(event: any) {
  if (event.moved) {
    // event indices are relative to the rendered window (visibleStackOptions); shift to absolute
    // indices into the full groupingFieldColOptions list.
    const oldIndex = stackWindow.value.start + event.moved.oldIndex
    const newIndex = stackWindow.value.start + event.moved.newIndex

    // Create a copy of the current stack metadata
    const stackMeta = [...groupingFieldColOptions.value]

    // Update both stacks in the local copy
    stackMeta[oldIndex] = { ...stackMeta[oldIndex], order: newIndex }
    stackMeta[newIndex] = { ...stackMeta[newIndex], order: oldIndex }

    // Prepare the updated stack metadata object
    const updatedStackMetaObj = {
      ...stackMetaObj.value,
      [kanbanMetaData.value.fk_grp_col_id!]: stackMeta,
    }

    await updateKanbanMeta({
      meta: updatedStackMetaObj,
    })
  }
}

async function onMove(event: any, stackKey: string) {
  if (event.added) {
    const ele = event.added.element
    ele.row[groupingField.value] = stackKey
    // The target stack may not have been loaded yet (windowed loading) — its Draggable list was an
    // empty fallback, so seed formattedData with the dropped card so it shows instead of vanishing.
    // `|| 0` guards the count for the same not-yet-loaded case.
    if (!formattedData.value.get(stackKey)) {
      formattedData.value.set(stackKey, [ele])
    }
    countByStack.value.set(stackKey, (countByStack.value.get(stackKey) || 0) + 1)
    // Remember the move so drag end can reconcile it against the reloaded data: the grouped-data read
    // can briefly lag a just-committed move, so a reload of the target may come back without this row.
    lastCardMove.value = { row: ele, toKey: stackKey, fromKey: lastCardMove.value.fromKey }
    pendingCardMove.value = updateOrSaveRow(ele)
    await pendingCardMove.value
  } else if (event.removed) {
    countByStack.value.set(stackKey, Math.max(0, (countByStack.value.get(stackKey) || 0) - 1))
    lastCardMove.value = { row: lastCardMove.value.row, toKey: lastCardMove.value.toKey, fromKey: stackKey }
  }
}

// Track if we're currently updating slices to prevent loops
let isUpdatingSlices = false
// Track if we're in a scroll handler to prevent watch triggers (simple flag like Gallery.vue)
let scrollRaf = false
// Track if we're loading more data to prevent watch triggers during load
const loadingMoreData = new Map<string | null, boolean>()
// Track last update time per stack to throttle updates
const lastSliceUpdateTime = new Map<string | null, number>()
const SLICE_UPDATE_THROTTLE_MS = 50 // Throttle slice updates to prevent loops

// Helper to update stackCardSlices with reactivity (shallowRef requires new Map reference)
const updateStackCardSlice = (stackTitle: string | null, slice: { start: number; end: number }, duringScroll = false) => {
  const currentSlice = stackCardSlices.value.get(stackTitle)
  // Only update if the slice actually changed to prevent unnecessary reactivity and loops
  if (currentSlice && currentSlice.start === slice.start && currentSlice.end === slice.end) {
    return
  }

  // Throttle updates during scroll to prevent loops
  if (duringScroll) {
    const now = Date.now()
    const lastUpdate = lastSliceUpdateTime.get(stackTitle) || 0
    if (now - lastUpdate < SLICE_UPDATE_THROTTLE_MS) {
      // Skip update if too soon - will be updated on next scroll event
      return
    }
    lastSliceUpdateTime.set(stackTitle, now)
  }

  // Apply update
  const newMap = new Map(stackCardSlices.value)
  newMap.set(stackTitle, slice)
  stackCardSlices.value = newMap

  // Only increment version counter if not during scroll (prevents triggering watch)
  // During scroll, we update the Map but don't trigger the watch
  if (!duringScroll) {
    slicesVersion.value++
  }
}

// Calculate visible card range for a specific stack - uses dynamic card height
const calculateCardSlice = (stackTitle: string | null, scrollTop: number, containerHeight: number) => {
  // Note: isUpdatingSlices is only used in debouncedRecalculateSlices to prevent multiple batch updates
  // Individual calculateCardSlice calls from scroll handlers should proceed normally

  const stack = formattedData.value.get(stackTitle)
  if (!stack || !stack.length) {
    const currentSlice = stackCardSlices.value.get(stackTitle)
    if (!currentSlice || currentSlice.end !== 0) {
      updateStackCardSlice(stackTitle, { start: 0, end: 0 })
    }
    return
  }

  const currentCardHeight = cardHeight.value
  // If card height is not calculated yet, use a reasonable default and show all items initially
  if (!currentCardHeight || currentCardHeight <= 0) {
    // Set initial slice to show all items if height not calculated yet
    const currentSlice = stackCardSlices.value.get(stackTitle)
    if (!currentSlice || currentSlice.end !== stack.length) {
      updateStackCardSlice(stackTitle, { start: 0, end: stack.length })
    }
    return
  }

  // If container not ready, calculate initial slice based on container height
  if (containerHeight === 0) {
    if (!stackCardSlices.value.has(stackTitle)) {
      // Calculate how many cards can fit in a reasonable initial viewport (e.g., 600px)
      const initialViewportHeight = 600
      const cardHeightWithGap = currentCardHeight + 8
      // Add buffer to ensure we show enough items
      const BUFFER_ROWS = 3
      const initialVisibleCount = Math.ceil(initialViewportHeight / cardHeightWithGap) + BUFFER_ROWS
      const initialEnd = Math.min(stack.length, initialVisibleCount)
      if (initialEnd > 0) {
        updateStackCardSlice(stackTitle, { start: 0, end: initialEnd })
      }
    }
    return
  }

  // Calculate visible range based on scroll position and container height
  // Use average height per item for calculation (accounts for first/last item differences)
  // Formula: N * (cardHeight + 8) + 8 = total height
  // Average per item: (total height) / N = cardHeight + 8 + 8/N
  // For large N, this approximates to cardHeight + 8
  const cardHeightWithGap = currentCardHeight + 8 // Average gap between items

  // Calculate start index using average height
  const startIndex = Math.max(0, Math.floor(scrollTop / cardHeightWithGap))

  // Calculate how many items can fit in the viewport
  // Add extra buffer to ensure we don't miss items at the bottom
  const visibleCount = Math.ceil(containerHeight / cardHeightWithGap) + 2
  const endIndex = Math.min(startIndex + visibleCount, stack.length)

  // Add buffer rows for smooth scrolling (render items above and below viewport)
  // Increase buffer for fast scrolling to ensure elements are always rendered
  const BUFFER_ROWS = 5
  let newStart = Math.max(0, startIndex - BUFFER_ROWS)
  let newEnd = Math.min(stack.length, endIndex + BUFFER_ROWS)

  // Ensure we always show at least enough items to fill the viewport
  if (newEnd - newStart < visibleCount) {
    newEnd = Math.min(newStart + visibleCount + BUFFER_ROWS, stack.length)
  }

  // Ensure valid range
  if (newStart >= newEnd || newStart < 0 || newEnd > stack.length) {
    newStart = 0
    newEnd = Math.min(visibleCount + BUFFER_ROWS * 2, stack.length)
  }

  // Only update if changed - updateStackCardSlice already checks internally
  // Update immediately during scroll (but skip version increment to prevent watch)
  updateStackCardSlice(stackTitle, { start: newStart, end: newEnd }, scrollRaf)
}

const kanbanListScrollHandler = useDebounceFn(async (e: any) => {
  if (!e.target) return

  if (e.target.scrollTop + e.target.clientHeight + INFINITY_SCROLL_THRESHOLD >= e.target.scrollHeight) {
    const stackTitle = e.target.getAttribute('data-stack-title')
    const pageSize = appInfo.value.defaultLimit || 25
    const stack = formattedData.value.get(stackTitle)

    // Prevent multiple simultaneous loadMoreKanbanData calls for the same stack
    if (loadingMoreData.get(stackTitle)) {
      return
    }

    if (stack && (countByStack.value.get(stackTitle) === undefined || stack.length < countByStack.value.get(stackTitle)!)) {
      loadingMoreData.set(stackTitle, true)
      const page = Math.ceil(stack.length / pageSize)
      const oldLength = stack.length

      try {
        await loadMoreKanbanData(stackTitle, {
          offset:
            page * pageSize > countByStack.value.get(stackTitle)! || page * pageSize > stack.length
              ? (page - 1) * pageSize
              : page * pageSize,
        })

        // After loading more data, recalculate slice to include new items
        nextTick(() => {
          const newStack = formattedData.value.get(stackTitle)
          if (newStack && newStack.length > oldLength) {
            const currentSlice = stackCardSlices.value.get(stackTitle)
            const scrollTop = e.target.scrollTop
            const containerHeight = e.target.clientHeight
            const scrollHeight = e.target.scrollHeight
            const newStackLength = newStack.length

            // Check if we're at or near the bottom (within threshold)
            const isAtBottom = scrollTop + containerHeight >= scrollHeight - INFINITY_SCROLL_THRESHOLD
            // Also check if slice was showing items near the end
            const wasShowingEnd = currentSlice && currentSlice.end >= oldLength - CARD_VIRTUAL_MARGIN * 2

            if (isAtBottom || wasShowingEnd) {
              // We're at the bottom or were showing end items, so expand slice to include ALL new items
              // Use a small delay to ensure DOM has updated with new scrollHeight
              setTimeout(() => {
                const cardHeightWithGap = cardHeight.value + 8 // 8px gap between cards
                const startIndex = Math.max(0, Math.floor(scrollTop / cardHeightWithGap))
                const visibleCount = Math.ceil(containerHeight / cardHeightWithGap)

                // Calculate new slice - ensure we show all newly loaded items
                const BUFFER_ROWS = 2
                const newStart = Math.max(0, startIndex - BUFFER_ROWS)
                // Expand end to include all new items - use the full new stack length
                const newEnd = Math.min(
                  newStackLength,
                  Math.max(
                    currentSlice ? currentSlice.end + (newStackLength - oldLength) : newStackLength,
                    startIndex + visibleCount + BUFFER_ROWS,
                  ),
                )

                // Update with duringScroll=true to prevent triggering watch
                updateStackCardSlice(stackTitle, { start: newStart, end: newEnd }, true)
              }, 50)
            } else {
              // Not at the end, just recalculate normally
              setTimeout(() => {
                calculateCardSlice(stackTitle, scrollTop, containerHeight)
              }, 50)
            }
          }
          // Reset loading flag after a delay to allow DOM to update
          setTimeout(() => {
            loadingMoreData.set(stackTitle, false)
          }, 200)
        })
      } catch (error) {
        // Reset loading flag on error
        loadingMoreData.set(stackTitle, false)
        console.error('Error loading more kanban data:', error)
      }
    }
  }
})

const handleDeleteStackClick = (stackTitle: string, stackIdx: number) => {
  deleteStackVModel.value = true
  stackToBeDeleted.value = stackTitle
  stackIdxToBeDeleted.value = stackIdx
}

const handleDeleteStackConfirmClick = async () => {
  await deleteStack(stackToBeDeleted.value, stackIdxToBeDeleted.value)
  deleteStackVModel.value = false
}

const handleCollapseStack = async (stackIdx: number) => {
  const currentCollapsed = groupingFieldColOptions.value[stackIdx].collapsed
  await updateStackProperty(stackIdx, { collapsed: !currentCollapsed })
}

const handleCollapseAllStack = async () => {
  await updateAllStacksProperty((stack) => {
    if (stack.id !== addNewStackId && !stack.collapsed) {
      return { collapsed: true }
    }
    return null // No update needed
  })
}

const handleExpandAllStack = async () => {
  await updateAllStacksProperty((stack) => {
    if (stack.id !== addNewStackId && stack.collapsed) {
      return { collapsed: false }
    }
    return null // No update needed
  })
}

const handleCellClick = (col, event) => {
  if (isButton(col)) {
    event.stopPropagation()
  }
}

// Track scroll position for each stack - use shallowRef to reduce reactive overhead
const kanbanListRefs = shallowRef<Map<string | null, HTMLElement>>(new Map())

const cardSliceCalculationRafs = new Map<string | null, number>()
// Track scroll handlers for cleanup
const scrollHandlers = new Map<string | null, (e: Event) => void>()
// Track which stacks have been initialized to prevent re-initialization
const initializedStacks = new Set<string | null>()

// Helper to check visibility - uses version counter for reactivity (more efficient than hash)
// This function is called in template v-if, so it must access reactive values to trigger re-renders
const isCardVisible = (stackTitle: string | null, index: number): boolean => {
  const stackKey = stackTitle ?? null
  const slice = stackCardSlices.value.get(stackKey)

  if (!slice) {
    // If no slice calculated yet, show items based on a reasonable viewport
    // or show all if card height not calculated
    const currentCardHeight = cardHeight.value
    if (!currentCardHeight || currentCardHeight <= 0) {
      // Show all items if height not calculated
      return true
    }
    const initialViewportHeight = 600
    const cardHeightWithGap = currentCardHeight + 8
    const BUFFER_ROWS = 3
    const initialVisibleCount = Math.ceil(initialViewportHeight / cardHeightWithGap) + BUFFER_ROWS
    return index < initialVisibleCount
  }

  // Check if index is within visible range
  // The slice already includes buffers, so we just check the slice bounds
  // Add a small extra buffer for edge cases
  const EXTRA_BUFFER = 1
  const isVisible = index >= Math.max(0, slice.start - EXTRA_BUFFER) && index < slice.end + EXTRA_BUFFER

  // If card height not calculated and we have a slice, show items in slice
  if (!cardHeight.value || cardHeight.value <= 0) {
    return index < slice.end
  }

  return isVisible
}

// Get total scroll height for a stack (for container height calculation)
const getTotalScrollHeight = (stackTitle: string | null) => {
  const stack = formattedData.value?.get(stackTitle)
  if (!stack || !stack.length) return 0

  const currentCardHeight = cardHeight.value
  if (!currentCardHeight || currentCardHeight <= 0) {
    // Fallback: use estimated height if not calculated yet
    return stack.length * 208 // 200px card + 8px gap
  }

  // Each item wrapper has class "nc-kanban-item py-1 first:pt-2 last:pb-2"
  // - py-1 = 4px top + 4px bottom (default wrapper padding)
  // - first:pt-2 = 8px top (overrides first item's top, adds 4px extra)
  // - last:pb-2 = 8px bottom (overrides last item's bottom, adds 4px extra)
  //
  // cardHeight already includes the card's internal padding and border
  // We need to add the wrapper div's padding on top of that
  //
  // For N items:
  // - First item: 8px top (wrapper) + cardHeight + 4px bottom (wrapper) = cardHeight + 12px
  // - Middle items: 4px top + cardHeight + 4px bottom = cardHeight + 8px each
  // - Last item: 4px top + cardHeight + 8px bottom = cardHeight + 12px
  //
  // Total = (cardHeight + 12) + (N-2) * (cardHeight + 8) + (cardHeight + 12)
  //       = N * cardHeight + 12 + 8N - 16 + 12
  //       = N * cardHeight + 8N + 8
  //       = N * (cardHeight + 8) + 8
  const wrapperPadding = 8 // Base wrapper padding per item (py-1 = 4px top + 4px bottom)
  const firstLastExtra = 8 // Extra padding: first gets +4px top, last gets +4px bottom

  const totalHeight = stack.length * (currentCardHeight + wrapperPadding) + firstLastExtra

  return totalHeight
}

// Create kanban list ref with scroll handler
const createKanbanListRef = (stackTitle: string | null): VNodeRef => {
  return (kanbanListElement) => {
    if (kanbanListElement) {
      const element = kanbanListElement as HTMLElement

      // Guard: Only initialize once per element to prevent infinite loops
      // Check if this exact element is already set up
      const existingElement = kanbanListRefs.value.get(stackTitle)
      if (existingElement === element && initializedStacks.has(stackTitle)) {
        // Same element already initialized, skip
        return
      }

      kanbanListRefs.value.set(stackTitle, element)

      // Remove old scroll handler if exists (use the stored handler from map)
      const oldScrollHandler = scrollHandlers.get(stackTitle)
      if (oldScrollHandler && existingElement) {
        existingElement.removeEventListener('scroll', oldScrollHandler)
      }

      // Cancel previous animation frame if it exists for this stack
      const existingRafForStack = cardSliceCalculationRafs.get(stackTitle)
      if (existingRafForStack) {
        cancelAnimationFrame(existingRafForStack)
      }

      // Initialize card slice immediately (only if not already set)
      // This ensures items are visible from the start
      // Use nextTick to avoid triggering during render
      if (!stackCardSlices.value.has(stackTitle)) {
        nextTick(() => {
          const stack = formattedData.value.get(stackTitle)
          if (stack && stack.length > 0) {
            // Calculate initial visible count based on container height or reasonable default
            const initialViewportHeight = element.clientHeight || 600
            const cardHeightWithGap = cardHeight.value + 8
            const BUFFER_ROWS = 3
            const initialVisibleCount = Math.ceil(initialViewportHeight / cardHeightWithGap) + BUFFER_ROWS
            const initialEnd = Math.min(stack.length, initialVisibleCount)
            updateStackCardSlice(stackTitle, { start: 0, end: initialEnd }, false)
          } else {
            updateStackCardSlice(stackTitle, { start: 0, end: 0 }, false)
          }
        })
      }

      let existingRaf: number | undefined

      let lastScrollTime = 0
      const SCROLL_THROTTLE_MS = 16 // Reduced throttle to ensure fast scrolling is handled (one frame)

      const scrollHandler = (e: Event) => {
        // Only call kanbanListScrollHandler if we're near the bottom (for infinite scroll)
        // This prevents it from being called on every scroll event
        if (
          e.target &&
          (e.target as HTMLElement).scrollTop + (e.target as HTMLElement).clientHeight + INFINITY_SCROLL_THRESHOLD >=
            (e.target as HTMLElement).scrollHeight
        ) {
          kanbanListScrollHandler(e)
        }
        const now = Date.now()

        // Light throttling to reduce memory churn but allow fast scrolling
        if (now - lastScrollTime < SCROLL_THROTTLE_MS) {
          // Still update slice even if throttled to ensure fast scrolling works
          // Cancel previous RAF and schedule new one immediately
          if (existingRaf) {
            cancelAnimationFrame(existingRaf)
          }
          const scrollTop = element.scrollTop
          const containerHeight = element.clientHeight
          existingRaf = requestAnimationFrame(() => {
            if (!scrollRaf) {
              scrollRaf = true
              try {
                calculateCardSlice(stackTitle, scrollTop, containerHeight)
              } catch (e) {
                scrollRaf = false
              }
              scrollRaf = false
            }
            existingRaf = undefined
          })
          cardSliceCalculationRafs.set(stackTitle, existingRaf)
          return
        }
        lastScrollTime = now

        const scrollTop = element.scrollTop
        const containerHeight = element.clientHeight

        // Update scroll position (with reactivity for shallowRef) - only when throttled
        const newScrollMap = new Map(stackScrollTops.value)
        newScrollMap.set(stackTitle, scrollTop)
        stackScrollTops.value = newScrollMap

        // Cancel previous animation frame if it exists
        if (existingRaf) {
          cancelAnimationFrame(existingRaf)
        }

        // Use requestAnimationFrame to batch the calculation for smooth scrolling (like Gallery.vue)
        existingRaf = requestAnimationFrame(() => {
          // Don't skip if scrollRaf is true - we need to process fast scrolling
          // Just ensure we don't have nested calls
          if (scrollRaf) {
            // If already processing, schedule another update immediately
            existingRaf = requestAnimationFrame(() => {
              scrollRaf = true
              try {
                calculateCardSlice(stackTitle, scrollTop, containerHeight)
              } catch (e) {
                scrollRaf = false
              }
              scrollRaf = false
              existingRaf = undefined
            })
            cardSliceCalculationRafs.set(stackTitle, existingRaf)
            return
          }

          scrollRaf = true
          try {
            // Always calculate slice on scroll - ensure items become visible
            // Updates are throttled and version increment is skipped to prevent watch
            calculateCardSlice(stackTitle, scrollTop, containerHeight)
          } catch (e) {
            // Ensure flag is reset even on error
            scrollRaf = false
          }

          // Reset flag immediately after calculation (like Gallery.vue)
          // This ensures fast scrolling can still process updates
          scrollRaf = false
          existingRaf = undefined
        })
        cardSliceCalculationRafs.set(stackTitle, existingRaf)
      }
      element.addEventListener('scroll', scrollHandler)
      // Store handler for cleanup
      scrollHandlers.set(stackTitle, scrollHandler)

      // Mark as initialized
      initializedStacks.add(stackTitle)

      // Initialize card slice after render (only once, and only if not already initialized)
      nextTick(() => {
        // Double-check we're still the current element (prevent race conditions)
        if (kanbanListRefs.value.get(stackTitle) !== element) {
          return
        }

        const stack = formattedData.value.get(stackTitle)

        // Ensure initial slice is set if not already set
        if (!stackCardSlices.value.has(stackTitle) && stack && stack.length > 0) {
          const initialViewportHeight = element.clientHeight || 600
          const cardHeightWithGap = cardHeight.value + 8
          const BUFFER_ROWS = 3
          const initialVisibleCount = Math.ceil(initialViewportHeight / cardHeightWithGap) + BUFFER_ROWS
          const initialEnd = Math.min(stack.length, initialVisibleCount)
          if (initialEnd > 0) {
            updateStackCardSlice(stackTitle, { start: 0, end: initialEnd }, false)
          }
        }

        if (element.clientHeight > 0) {
          const scrollTop = element.scrollTop || 0
          calculateCardSlice(stackTitle, scrollTop, element.clientHeight)
          // Don't dispatch scroll event - it causes infinite loops
        } else if (stack && stack.length > 0) {
          // Even if container height is 0, ensure we have a slice set
          const currentSlice = stackCardSlices.value.get(stackTitle)
          if (!currentSlice || currentSlice.end === 0) {
            const initialViewportHeight = 600
            const cardHeightWithGap = cardHeight.value + 8
            const BUFFER_ROWS = 3
            const initialVisibleCount = Math.ceil(initialViewportHeight / cardHeightWithGap) + BUFFER_ROWS
            const initialEnd = Math.min(stack.length, initialVisibleCount)
            if (initialEnd > 0) {
              updateStackCardSlice(stackTitle, { start: 0, end: initialEnd }, false)
            }
          }
        }
      })
    } else {
      // Element was removed - clean up
      if (kanbanListRefs.value.get(stackTitle)) {
        const oldScrollHandler = scrollHandlers.get(stackTitle)
        if (oldScrollHandler) {
          const existingElement = kanbanListRefs.value.get(stackTitle)
          if (existingElement) {
            existingElement.removeEventListener('scroll', oldScrollHandler)
          }
        }
        const existingRafForStack = cardSliceCalculationRafs.get(stackTitle)
        if (existingRafForStack) {
          cancelAnimationFrame(existingRafForStack)
        }
        kanbanListRefs.value.delete(stackTitle)
        scrollHandlers.delete(stackTitle)
        initializedStacks.delete(stackTitle)
      }
    }
  }
}

const openNewRecordFormHookHandler = async () => {
  const newRow = await addEmptyRow()
  // preset the grouping field value
  newRow.row = {
    [groupingField.value]: selectedStackTitle.value === '' ? null : selectedStackTitle.value,
  }
  // increase total count by 1
  countByStack.value.set(null, countByStack.value.get(null)! + 1)
  // open the expanded form
  expandForm(newRow)
}

openNewRecordFormHook?.on(openNewRecordFormHookHandler)

// Horizontal scroll handler
let horizontalScrollRaf: number | undefined
const handleHorizontalScroll = () => {
  if (horizontalScrollRaf) {
    cancelAnimationFrame(horizontalScrollRaf)
  }
  horizontalScrollRaf = requestAnimationFrame(() => {
    calculateStackSlice()
    horizontalScrollRaf = undefined
  })
}

// remove openNewRecordFormHookHandler before unmounting
// so that it won't be triggered multiple times
onBeforeUnmount(() => {
  // Reset so a store instance reused by the legacy Kanban falls back to its full load.
  useWindowedKanbanLoad.value = false

  openNewRecordFormHook.off(openNewRecordFormHookHandler)
  eventBus.off(smartsheetEventHandler)
  reloadViewMetaHook?.off(reloadViewMetaListener)
  reloadViewDataHook?.off(reloadViewDataListener)

  // Clear all timeouts and animation frames
  cardSliceCalculationRafs.forEach((raf) => {
    cancelAnimationFrame(raf)
  })
  cardSliceCalculationRafs.clear()

  // Remove all scroll event listeners
  kanbanListRefs.value.forEach((element, stackTitle) => {
    const handler = scrollHandlers.get(stackTitle)
    if (handler) {
      element.removeEventListener('scroll', handler)
    }
  })
  scrollHandlers.clear()

  // Clear refs to help with garbage collection
  kanbanListRefs.value.clear()
  stackScrollTops.value.clear()
  stackCardSlices.value.clear()
  lastSliceUpdateTime.clear()
  loadingMoreData.clear()
  initializedStacks.clear()

  // Clean up horizontal scroll handler
  if (kanbanContainerRef.value) {
    kanbanContainerRef.value.removeEventListener('scroll', handleHorizontalScroll)
  }
  if (horizontalScrollRaf) {
    cancelAnimationFrame(horizontalScrollRaf)
  }
})

// reset context menu target on hide
watch(contextMenu, () => {
  if (!contextMenu.value) {
    contextMenuTarget.value = null
  }
})

// Recalculate card slices when data changes
// Use a more efficient watch that tracks changes without creating large strings
// Debounce the watch callback to reduce frequency of updates
const debouncedRecalculateSlices = useDebounceFn(() => {
  // Prevent multiple simultaneous batch updates
  if (isUpdatingSlices) return

  // Don't recalculate if we're in a scroll handler (prevents loops)
  if (scrollRaf) return

  // Don't recalculate if we're loading more data (prevents loops during infinite scroll)
  if (Array.from(loadingMoreData.values()).some((loading) => loading)) {
    return
  }

  // Only recalculate if card height is available
  if (!cardHeight.value || cardHeight.value <= 0) {
    return
  }

  isUpdatingSlices = true

  nextTick(() => {
    groupingFieldColOptions.value.forEach((stack) => {
      const stackKey = stack.title ?? null
      const element = kanbanListRefs.value.get(stackKey)
      const stackData = formattedData.value.get(stackKey)

      if (element && element.clientHeight > 0) {
        const scrollTop = stackScrollTops.value.get(stackKey) || 0
        // Only recalculate if element is ready and we have data
        if (stackData && stackData.length > 0) {
          calculateCardSlice(stackKey, scrollTop, element.clientHeight)
        }
      } else if (stackData) {
        // Initialize slice even if element not found yet
        if (stackData.length > 0) {
          const initialViewportHeight = 600
          const cardHeightWithGap = cardHeight.value + 8
          const BUFFER_ROWS = 3
          const initialVisibleCount = Math.ceil(initialViewportHeight / cardHeightWithGap) + BUFFER_ROWS
          const initialEnd = Math.min(stackData.length, initialVisibleCount)
          const currentSlice = stackCardSlices.value.get(stackKey)
          if (!currentSlice || currentSlice.end !== initialEnd) {
            updateStackCardSlice(stackKey, { start: 0, end: initialEnd })
          }
        } else {
          const currentSlice = stackCardSlices.value.get(stackKey)
          if (!currentSlice || currentSlice.end !== 0) {
            updateStackCardSlice(stackKey, { start: 0, end: 0 })
          }
        }
      }
    })
    // Reset flag after all updates complete
    setTimeout(() => {
      isUpdatingSlices = false
    }, 100) // Increased timeout to ensure all updates complete
  })
}, 400) // Increased debounce to 400ms to reduce frequency and prevent loops

watch(
  () => {
    // Calculate hashes for formattedData keys and lengths to reduce string allocations
    let lengthHash = 0
    let keyHash = 0
    formattedData.value.forEach((stack, key) => {
      const stackLength = stack?.length || 0
      lengthHash = ((lengthHash << 5) - lengthHash + stackLength) | 0 // Simple hash for length
      const keyStr = key ?? 'null'
      for (let i = 0; i < keyStr.length; i++) {
        keyHash = ((keyHash << 5) - keyHash + keyStr.charCodeAt(i)) | 0
      }
    })
    return {
      size: formattedData.value.size,
      lengthHash, // Use hash instead of string
      keyHash, // Use hash instead of string
    }
  },
  debouncedRecalculateSlices,
  { deep: false }, // Deep watch is not needed with hash-based tracking
)

// Watch for changes to stacks to recalculate slice
watch(
  () => groupingFieldColOptions.value.length,
  () => {
    nextTick(() => {
      calculateStackSlice()
    })
  },
)

// Watch for container size changes
const { width: containerWidth } = useElementSize(kanbanContainerRef)
watch(containerWidth, () => {
  nextTick(() => {
    calculateStackSlice()
  })
})

onMounted(async () => {
  try {
    isViewDataLoading.value = true
    await loadVisibleStacks()

    nextTick(() => {
      if (kanbanContainerRef.value) {
        // Set up horizontal scroll listener
        kanbanContainerRef.value.addEventListener('scroll', handleHorizontalScroll)

        // Calculate initial stack slice
        calculateStackSlice()

        if (shouldScrollToRight.value) {
          kanbanContainerRef.value.scrollTo({
            left: kanbanContainerRef.value.scrollWidth,
            behavior: 'smooth',
          })
          // reset shouldScrollToRight
          shouldScrollToRight.value = false
        }
      }
    })
    isViewDataLoading.value = false
  } catch (error) {
    console.error(error)
    isViewDataLoading.value = false
  }
})

const getRowId = (row: RowType) => {
  const pk = extractPkFromRow(row.row, meta.value!.columns!)
  return pk ? `row-${pk}` : ''
}

const hideEmptyStack = computed<boolean>(() => parseProp(kanbanMetaData.value?.meta).hide_empty_stack || false)

const autoCollapseEmptyStack = computed<boolean>(() => parseProp(kanbanMetaData.value?.meta).auto_collapse_empty_stack || false)

// Session-only override: user-expanded auto-collapsed empty stacks for this view mount
const userExpandedEmptyStacks = ref<Set<string>>(new Set())

// Stacks temporarily expanded because a dragged card is hovering over them
const tempExpandedStacks = ref<Set<string>>(new Set())

const isStackEmpty = (stack: { title: string | null }) => {
  return !formattedData.value.get(stack.title)?.length
}

const isStackCollapsed = (stack: { id: string; title: string | null; collapsed?: boolean }) => {
  if (!stack || stack.id === addNewStackId) return false
  if (tempExpandedStacks.value.has(stack.id)) return false
  if (stack.collapsed) return true
  if (autoCollapseEmptyStack.value && isStackEmpty(stack) && !userExpandedEmptyStacks.value.has(stack.id)) {
    return true
  }
  return false
}

const handleCollapsedStackClick = (stack: { id: string; title: string | null; collapsed?: boolean }, stackIdx: number) => {
  const isAutoCollapsedEmpty = !stack.collapsed && autoCollapseEmptyStack.value && isStackEmpty(stack)
  if (isAutoCollapsedEmpty) {
    userExpandedEmptyStacks.value.add(stack.id)
    return
  }
  return handleCollapseStack(stackIdx)
}

// A bounded render window centred on the currently-viewed stacks. Frozen for the duration of a drag
// so the set of stacks Sortable tracks never changes mid-drag (which would break the drop).
const computeDragWindow = (span: number) => {
  const total = groupingFieldColOptions.value.length
  const viewStart = stackSlice.end ? stackSlice.start : 0
  const viewEnd = stackSlice.end ? stackSlice.end : Math.min(total, 6)

  let start = Math.max(0, Math.floor((viewStart + viewEnd) / 2 - span / 2))
  const end = Math.min(total, start + span)
  start = Math.max(0, end - span)

  return { start, end }
}

/**
 * Interface boards: dotted residue that holds the SOURCE spot during a drag.
 * Cross-list hovers make vuedraggable sync its arrays and re-render the source
 * list, which sweeps foreign DOM — a drag-scoped keeper re-inserts the residue
 * at its recorded index until drop.
 */
let dragResidueEl: HTMLElement | null = null
let dragResidueList: HTMLElement | null = null
let dragResidueIndex = 0
let dragResidueKeeper: ReturnType<typeof setInterval> | null = null

const handleCardDragStart = (e: any) => {
  isCardDragInProgress.value = true

  const total = groupingFieldColOptions.value.length
  let { start, end } = computeDragWindow(CARD_DRAG_SPAN)

  // Always include the source stack, even if the view was scrolled far from it before the grab.
  const rawTitle = e?.from?.closest?.('.nc-kanban-list')?.dataset?.stackTitle
  const sourceTitle = rawTitle == null || rawTitle === '' ? null : rawTitle
  const srcIdx = groupingFieldColOptions.value.findIndex((s) => (s.title ?? null) === sourceTitle)
  if (srcIdx >= 0) {
    if (srcIdx < start) {
      start = srcIdx
      end = Math.min(total, start + CARD_DRAG_SPAN)
    } else if (srcIdx >= end) {
      end = Math.min(total, srcIdx + 1)
      start = Math.max(0, end - CARD_DRAG_SPAN)
    }
  }

  cardDragWindow.value = { start, end }

  e.target.classList.add('grabbing')

  if (interfacePageDataApi && e.item) {
    const cardHeight = e.item.querySelector('.ant-card')?.offsetHeight ?? e.item.offsetHeight
    dragResidueEl = document.createElement('div')
    dragResidueEl.className = 'nc-kanban-drag-residue'
    dragResidueEl.style.height = `${cardHeight}px`
    dragResidueList = e.from ?? e.item.parentElement
    dragResidueIndex = e.oldIndex ?? 0
    e.item.parentElement?.insertBefore(dragResidueEl, e.item)

    dragResidueKeeper = setInterval(() => {
      if (!dragResidueEl || dragResidueEl.isConnected || !dragResidueList?.isConnected) return
      const anchor = dragResidueList.querySelectorAll(':scope > .nc-kanban-item')[dragResidueIndex] ?? null
      dragResidueList.insertBefore(dragResidueEl, anchor)
    }, 120)
  }
}

// Ensure the moved row is present in its target stack and absent from its source stack, fixing the
// counts. A no-op when the reloaded data already reflects the move.
const reconcileCardMove = (move: { row: any; fromKey: string | null; toKey: string | null }) => {
  if (!move?.row || !meta.value?.columns) return
  const pk = extractPkFromRow(move.row.row, meta.value.columns as ColumnType[])
  if (pk === undefined || pk === null) return

  const hasRow = (key: string | null) =>
    (formattedData.value.get(key) || []).some((r) => extractPkFromRow(r.row, meta.value!.columns as ColumnType[]) === pk)

  // Target: add the moved row if the reload didn't include it yet.
  if (move.toKey !== null && move.toKey !== undefined && !hasRow(move.toKey)) {
    const next = new Map(formattedData.value)
    next.set(move.toKey, [move.row, ...(next.get(move.toKey) || [])])
    formattedData.value = next
    countByStack.value.set(move.toKey, (countByStack.value.get(move.toKey) || 0) + 1)
  }

  // Source: drop the moved row if a stale reload re-added it.
  if (move.fromKey !== null && move.fromKey !== undefined && hasRow(move.fromKey)) {
    const next = new Map(formattedData.value)
    next.set(
      move.fromKey,
      (next.get(move.fromKey) || []).filter((r) => extractPkFromRow(r.row, meta.value!.columns as ColumnType[]) !== pk),
    )
    formattedData.value = next
    countByStack.value.set(move.fromKey, Math.max(0, (countByStack.value.get(move.fromKey) || 0) - 1))
  }
}

const handleCardDragEnd = async (e: any) => {
  isCardDragInProgress.value = false
  cardDragWindow.value = null
  tempExpandedStacks.value.clear()
  e.target.classList.remove('grabbing')

  // Height-collapse the source residue, then drop it from the DOM. Runs before the awaits
  // below so the placeholder clears the moment the card lands, not after the persist +
  // reload round-trip.
  if (dragResidueKeeper) {
    clearInterval(dragResidueKeeper)
    dragResidueKeeper = null
  }
  if (dragResidueEl) {
    const el = dragResidueEl
    dragResidueEl = null
    dragResidueList = null
    el.classList.add('nc-collapsing')
    setTimeout(() => el.remove(), 220)
  }

  const move = lastCardMove.value
  lastCardMove.value = { row: null, fromKey: null, toKey: null }

  // Wait for the drop's persist to commit before reloading, then load the window the user ended on
  // (loading was suppressed during the drag). Already-loaded stacks keep their optimistic state; only
  // genuinely-unloaded stacks (e.g. a not-yet-loaded drop target) are fetched.
  try {
    await pendingCardMove.value
  } catch {
    // The error is already surfaced by updateOrSaveRow; still reload to resync the view.
  }
  pendingCardMove.value = null

  await loadVisibleStacks()

  // The grouped-data read can lag a just-committed move by a moment, so a freshly-fetched drop target
  // may come back without the moved row (and the source still holding it). Reconcile the known move
  // so the card lands in its new stack regardless of read-after-write lag; it self-corrects to the
  // authoritative server state on the next natural reload.
  reconcileCardMove(move)
}

const handleStackDragStart = (e: any) => {
  isStackDragInProgress.value = true
  // Freeze the rendered window so off-screen stacks stay mounted as valid drop positions while
  // auto-scrolling. The dragged stack is necessarily already on screen, so a view-centred span
  // always contains it.
  stackDragWindow.value = computeDragWindow(STACK_DRAG_SPAN)
  e.target.classList.add('grabbing')
}

const handleStackDragEnd = (e: any) => {
  isStackDragInProgress.value = false
  stackDragWindow.value = null
  e.target.classList.remove('grabbing')
}

const handleCollapsedStackDragEnter = (stack: { id: string; collapsed?: boolean }) => {
  if (!isCardDragInProgress.value) return
  tempExpandedStacks.value.add(stack.id)
}

const onMoveAndPersistExpand = async (event: any, stackTitle: string | null, stackIdx: number) => {
  // Drop has happened — sortable.js's `@end` fires after a delay (DOM cleanup + animation),
  // so clear the drag flag here to prevent post-drop mouseenters from flicker-expanding
  // other collapsed stacks the user moves over.
  isCardDragInProgress.value = false
  await onMove(event, stackTitle)
  // After a successful drop into a previously-collapsed stack, persist it as expanded
  if (event?.added && groupingFieldColOptions.value[stackIdx]?.collapsed) {
    await updateStackProperty(stackIdx, { collapsed: false })
  }
}

const addNewStackObj = {
  id: addNewStackId,
}

const isRenameOrNewStack = ref(null)

const compareStack = (stack: any, stack2?: any) => stack?.id && stack2?.id && stack.id === stack2.id

const isSavingStack = ref(null)

const handleSubmitRenameOrNewStack = async (loadMeta: boolean, stack?: any, stackIdx?: number) => {
  isSavingStack.value = isRenameOrNewStack.value
  isRenameOrNewStack.value = null

  if (stack && stack?.title && stack?.color && stackIdx !== undefined) {
    await updateStackProperty(stackIdx, {
      title: stack.title,
      color: stack.color,
    })
  }

  isSavingStack.value = null
}

const draggableStackFilter = (event: Event) => {
  return event.target?.closest('.not-draggable')
  // || isTouchEvent(event) // allow drag and drop for touch devices for now
}

const draggableCardFilter = (event: Event, target: HTMLElement) => {
  const eventTarget = event.target as HTMLElement | null
  const closestNotDraggable = eventTarget?.closest('.not-draggable')

  return !!(
    eventTarget &&
    target &&
    target.contains(eventTarget) &&
    closestNotDraggable &&
    (target.contains(closestNotDraggable) || closestNotDraggable === target)
  )
  // || isTouchEvent(event) // allow drag and drop for touch devices for now
}

const handleOpenNewRecordForm = (stackTitle?: string) => {
  if (showRecordPlanLimitExceededModal()) return

  selectedStackTitle.value = stackTitle ?? ''

  // Interface pages: create via the configured record form / create card
  // (mirrors the calendar viz), prefilled with the stack's grouping value. The
  // classic expanded-record form is intentionally not used on interface pages.
  if (interfacePageDataApi) {
    interfaceNewRecordForm.value?.({
      [groupingField.value]: stackTitle && stackTitle !== '' ? stackTitle : null,
    })
    return
  }

  openNewRecordFormHook.trigger()
}

const resetPointerEvent = (record: RowType, col: ColumnType) => {
  return isButton(col) || (isRowEmpty(record, col) && isAllowToRenderRowEmptyField(col))
}
</script>

<template>
  <div
    class="flex flex-col w-full bg-nc-bg-gray-extralight h-full"
    data-testid="nc-kanban-wrapper"
    :style="{
      minHeight: 'calc(100% - var(--topbar-height))',
    }"
  >
    <div
      ref="kanbanContainerRef"
      class="nc-kanban-container flex p-3 overflow-y-hidden w-full nc-view-scrollbar-x min-h-[calc(100%_-_0.4rem)] max-h-[calc(100%_-_0.4rem)]"
    >
      <div v-if="isViewDataLoading" class="flex flex-row min-h-full gap-x-2">
        <a-skeleton-input v-for="index of Array(20)" :key="index" class="!min-w-80 !min-h-full !rounded-xl overflow-hidden" />
      </div>
      <NcDropdown
        v-else
        v-model:visible="contextMenu"
        :trigger="['contextmenu']"
        overlay-class-name="nc-dropdown-kanban-context-menu"
      >
        <div class="flex gap-3" @contextmenu.capture="resetContextMenuTarget">
          <!-- Left spacer standing in for off-screen stacks (horizontal virtual scroll) -->
          <div v-if="leftStackSpacerWidth" class="flex-none" :style="{ width: `${leftStackSpacerWidth}px` }" aria-hidden="true" />
          <!-- Draggable Stack -->
          <Draggable
            :list="visibleStackOptions"
            v-bind="getDraggableAutoScrollOptions({ scrollSensitivity: 100 })"
            class="flex gap-3"
            item-key="id"
            group="kanban-stack"
            draggable=".nc-kanban-stack"
            handle=".nc-kanban-stack-drag-handler"
            :filter="draggableStackFilter"
            :move="onMoveCallback"
            @start="handleStackDragStart"
            @end="handleStackDragEnd"
            @change="onMoveStack($event)"
          >
            <!-- Collapsed strips are 52px on interfaces (matching the expanded
                 header height); the classic board keeps its 44px rail.
                 Comment stays OUTSIDE #item: vuedraggable counts the comment
                 vnode as a second child and throws "Item slot must have only
                 one child" (dev builds only — prod strips comments). -->
            <template #item="{ element: stack, index: relStackIdx }">
              <div
                class="nc-kanban-stack"
                :class="{
                  'w-[52px]': isStackCollapsed(stack) && !!interfacePageDataApi,
                  'w-[44px]': isStackCollapsed(stack) && !interfacePageDataApi,
                  'nc-kanban-stack-interface-collapsed': !!interfacePageDataApi && isStackCollapsed(stack),
                  'hidden':
                    (hideEmptyStack && !formattedData.get(stack.title)?.length) ||
                    (isRequiredGroupingFieldColumn && stack.id === uncategorizedStackId),
                }"
                :data-testid="`nc-kanban-stack-${stack.title}`"
              >
                <!-- Non Collapsed Stacks -->
                <a-card
                  v-if="!isStackCollapsed(stack)"
                  :key="stack.id"
                  class="flex flex-col w-68.5 h-full !rounded-xl overflow-y-hidden !shadow-none !hover:shadow-none !border-nc-border-gray-medium"
                  :class="{
                    'not-draggable': stack.title === null || isLocked || isPublic || !hasEditPermission,
                    '!cursor-default': isLocked || !hasEditPermission,
                  }"
                  :head-style="{ paddingBottom: '0px' }"
                  :body-style="{
                    padding: '0px !important',
                    height: '100%',
                    borderRadius: '0.75rem !important',
                    paddingBottom: '0rem !important',
                  }"
                >
                  <!-- Skeleton. Suppressed while a card is being dragged: loading is paused during the
                       drag, so an unloaded stack would stay stuck on the skeleton and never expose its
                       card list as a drop target — render the (empty) stack body instead. -->
                  <div
                    v-if="(!formattedData.get(stack.title) || !countByStack) && !isCardDragInProgress"
                    class="mt-2.5 px-3 !w-full"
                  >
                    <a-skeleton-input :active="true" class="!w-full !h-9.75 !rounded-lg overflow-hidden" />
                  </div>

                  <!-- Stack -->
                  <a-layout v-else>
                    <a-layout-header
                      class="border-b-1 border-nc-border-gray-light min-h-[49px]"
                      :class="`nc-kanban-stack-header-${stack.id}`"
                    >
                      <div
                        class="nc-kanban-stack-head w-full flex gap-1"
                        :class="{
                          'items-start': compareStack(stack, isRenameOrNewStack),
                          'items-center': !compareStack(stack, isRenameOrNewStack),
                        }"
                      >
                        <div
                          class="flex-1 flex gap-1 max-w-[calc(100%_-_32px)]"
                          :class="{
                            'items-start': compareStack(stack, isRenameOrNewStack),
                            'items-center': !compareStack(stack, isRenameOrNewStack),
                          }"
                        >
                          <NcButton
                            v-if="!(isLocked || isPublic || !hasEditPermission || interfacePageDataApi)"
                            :disabled="
                              !stack.title || compareStack(stack, isSavingStack) || compareStack(stack, isRenameOrNewStack)
                            "
                            type="text"
                            size="xs"
                            class="nc-kanban-stack-drag-handler !px-1.5 !cursor-move !:disabled:cursor-not-allowed mt-0.5"
                          >
                            <GeneralLoader v-if="compareStack(stack, isSavingStack)" size="regular" class="stack-rename-loader" />
                            <GeneralIcon v-else icon="ncDrag" class="!font-weight-800 flex-none" />
                          </NcButton>

                          <div
                            class="flex-1 flex max-w-[calc(100%_-_28px)]"
                            :class="{
                              '-ml-1': compareStack(stack, isRenameOrNewStack),
                            }"
                          >
                            <template
                              v-if="compareStack(stack, isRenameOrNewStack) && metaColumnById[isRenameOrNewStack?.fk_column_id]"
                            >
                              <SmartsheetKanbanEditOrAddStack
                                :column="metaColumnById[isRenameOrNewStack?.fk_column_id]"
                                :option-id="isRenameOrNewStack.id"
                                @submit="
                                  (loadMeta, payload) =>
                                    handleSubmitRenameOrNewStack(loadMeta, payload, getAbsStackIdx(relStackIdx))
                                "
                              />
                            </template>
                            <a-tag
                              v-else
                              class="max-w-full !rounded-full !px-2 !py-1 h-7 !m-0 !border-none !mt-0.5"
                              :color="
                                getSelectTypeFieldOptionBgColor({
                                  color: stack.color || '#ccc',
                                  isDark,
                                  getColor,
                                  isColorCodeEnabled,
                                })
                              "
                              @dblclick="
                                () => {
                                  if (
                                    stack.title !== null &&
                                    isUIAllowed('fieldAdd') &&
                                    hasEditPermission &&
                                    !isPublic &&
                                    !isLocked
                                  ) {
                                    isRenameOrNewStack = stack
                                  }
                                }
                              "
                            >
                              <span
                                :style="{
                                  color: getSelectTypeFieldOptionTextColor({
                                    color: stack.color || '#ccc',
                                    isDark,
                                    getColor,
                                    isColorCodeEnabled,
                                  }),
                                }"
                                class="text-sm font-semibold"
                              >
                                <NcTooltip class="truncate max-w-full" placement="bottom" show-on-truncate-only>
                                  <template #title>
                                    {{ stack.title ?? $t('labels.uncategorized') }}
                                  </template>
                                  <span
                                    data-testid="nc-kanban-stack-title"
                                    class="text-ellipsis overflow-hidden"
                                    :style="{
                                      wordBreak: 'keep-all',
                                      whiteSpace: 'nowrap',
                                      display: 'inline',
                                    }"
                                  >
                                    {{ stack.title ?? $t('labels.uncategorized') }}
                                  </span>
                                </NcTooltip>
                              </span>
                            </a-tag>
                            <!-- Interface: the stack footer is removed, so the total count rides the header -->
                            <span
                              v-if="interfacePageDataApi && !compareStack(stack, isRenameOrNewStack)"
                              class="nc-kanban-stack-header-count self-center flex-none ml-2 text-[12px] font-weight-500 text-nc-content-gray-muted"
                              data-testid="nc-kanban-stack-header-count"
                            >
                              {{ countByStack.get(stack.title) ?? 0 }}
                            </span>
                          </div>
                        </div>
                        <NcTooltip :title="$t('activity.kanban.collapseStack')" placement="top">
                          <NcButton
                            v-e="['c:kanban:collapse-stack']"
                            :disabled="compareStack(stack, isSavingStack)"
                            type="text"
                            size="xs"
                            class="!px-1.5 mt-0.5"
                            :class="{ 'nc-kanban-stack-hover-action': !!interfacePageDataApi }"
                            data-testid="nc-kanban-stack-collapse-btn"
                            @click="handleCollapseStack(getAbsStackIdx(relStackIdx))"
                          >
                            <GeneralIcon icon="minimize" class="h-3.5 w-3.5 opacity-75" />
                          </NcButton>
                        </NcTooltip>
                        <NcDropdown
                          placement="bottomRight"
                          overlay-class-name="nc-dropdown-kanban-stack-context-menu"
                          class="bg-nc-bg-default !rounded-lg"
                        >
                          <NcButton
                            :disabled="compareStack(stack, isSavingStack)"
                            type="text"
                            size="xs"
                            class="!px-1.5 mt-0.5"
                            :class="{ 'nc-kanban-stack-hover-action': !!interfacePageDataApi }"
                            data-testid="nc-kanban-stack-context-menu"
                          >
                            <GeneralIcon icon="threeDotVertical" />
                          </NcButton>

                          <template #overlay>
                            <NcMenu :variant="interfacePageDataApi ? 'medium' : 'small'">
                              <PermissionsTooltip
                                v-if="hasEditPermission && !isPublic && !isSyncedTable && canAddDeleteRows"
                                :entity="PermissionEntity.TABLE"
                                :entity-id="meta?.id"
                                :permission="PermissionKey.TABLE_RECORD_ADD"
                                placement="right"
                              >
                                <template #default="{ isAllowed }">
                                  <NcMenuItem
                                    v-e="['c:kanban:add-new-record']"
                                    data-testid="nc-kanban-context-menu-add-new-record"
                                    :disabled="!isAllowed"
                                    @click="handleOpenNewRecordForm(stack.title)"
                                  >
                                    <div class="flex gap-2 items-center">
                                      <component :is="iconMap.plus" class="flex-none w-4 h-4" />
                                      {{ $t('activity.newRecord') }}
                                    </div>
                                  </NcMenuItem>
                                </template>
                              </PermissionsTooltip>
                              <NcMenuItem
                                v-if="
                                  stack.title !== null && isUIAllowed('fieldAdd') && hasEditPermission && !isPublic && !isLocked
                                "
                                v-e="['c:kanban:rename-stack']"
                                data-testid="nc-kanban-context-menu-rename-stack"
                                @click="
                                  () => {
                                    isRenameOrNewStack = stack
                                  }
                                "
                              >
                                <div class="flex gap-2 items-center">
                                  <component :is="iconMap.ncEdit" class="flex-none w-4 h-4" />
                                  {{ $t('activity.kanban.renameStack') }}
                                </div>
                              </NcMenuItem>
                              <NcMenuItem
                                v-e="['c:kanban:collapse-all-stack']"
                                data-testid="nc-kanban-context-menu-collapse-all-stack"
                                @click="handleCollapseAllStack"
                              >
                                <div class="flex gap-2 items-center">
                                  <component :is="iconMap.minimizeAll" class="flex-none w-4 h-4" />
                                  {{ $t('activity.kanban.collapseAll') }}
                                </div>
                              </NcMenuItem>
                              <NcMenuItem
                                v-e="['c:kanban:expand-all-stack']"
                                data-testid="nc-kanban-context-menu-expand-all-stack"
                                @click="handleExpandAllStack"
                              >
                                <div class="flex gap-2 items-center">
                                  <component :is="iconMap.maximizeAll" class="flex-none w-4 h-4" />
                                  {{ $t('activity.kanban.expandAll') }}
                                </div>
                              </NcMenuItem>
                              <template
                                v-if="
                                  stack.title !== null && isUIAllowed('fieldAdd') && !isPublic && hasEditPermission && !isLocked
                                "
                              >
                                <NcDivider />
                                <NcMenuItem
                                  v-e="['c:kanban:delete-stack']"
                                  danger
                                  data-testid="nc-kanban-context-menu-delete-stack"
                                  @click="handleDeleteStackClick(stack.title, getAbsStackIdx(relStackIdx))"
                                >
                                  <div class="flex gap-2 items-center">
                                    <component :is="iconMap.delete" class="flex-none w-4 h-4" />
                                    {{ $t('activity.kanban.deleteStack') }}
                                  </div>
                                </NcMenuItem>
                              </template>
                            </NcMenu>
                          </template>
                        </NcDropdown>
                      </div>
                    </a-layout-header>

                    <a-layout-content
                      class="overflow-y-hidden"
                      :style="{
                        backgroundColor: tinycolor
                          .mix(
                            stack.color || '#ccc',
                            '#ffffff',
                            tinycolor(stack.color || '#ccc').isLight()
                              ? 70
                              : tinycolor(stack.color || '#ccc').getBrightness() <= 100
                              ? 80
                              : 90,
                          )
                          .toString(),
                      }"
                    >
                      <div
                        :ref="createKanbanListRef(stack.title)"
                        class="nc-kanban-list px-2 nc-scrollbar-thin"
                        :data-stack-title="stack.title"
                        :class="{
                          'relative overflow-hidden': !formattedData.get(stack.title)?.length,
                          'overflow-y-auto': formattedData.get(stack.title)?.length,
                        }"
                        :style="{
                          height: '100%',
                        }"
                      >
                        <!-- Draggable Record Card - full list for drag functionality, but only render visible items.
                             Also render during a card drag even if this stack's rows haven't loaded yet, so a stack
                             scrolled into view mid-drag still exists as a valid drop target. -->
                        <Draggable
                          v-if="formattedData.get(stack.title) || isCardDragInProgress"
                          v-bind="getDraggableAutoScrollOptions({ scrollSensitivity: 150 })"
                          :list="formattedData.get(stack.title) || []"
                          item-key="row.id"
                          draggable=".nc-kanban-item"
                          group="kanban-card"
                          class="flex flex-col"
                          :style="{
                            // At least the virtual scroll height (keeps the scrollbar honest) but never
                            // shorter than the column, so the blank space below the last card is still a
                            // valid drop area — without this a drop only registers when hovering a card.
                            minHeight: `max(${getTotalScrollHeight(stack.title)}px, 100%)`,
                            height: formattedData.get(stack.title)?.length ? 'auto' : '100%',
                          }"
                          :disabled="isMobileMode"
                          :filter="draggableCardFilter"
                          :animation="interfacePageDataApi ? 150 : 0"
                          @start="handleCardDragStart"
                          @end="handleCardDragEnd"
                          @change="onMoveAndPersistExpand($event, stack.title, getAbsStackIdx(relStackIdx))"
                        >
                          <template #item="{ element: record, index }">
                            <div class="nc-kanban-item py-1 first:pt-2 last:pb-2">
                              <SmartsheetRow v-if="isCardVisible(stack.title, index)" :row="record">
                                <a-card
                                  :key="`${getRowId(record)}-${index}`"
                                  class="!rounded-lg h-full border-nc-border-gray-medium border-1 group overflow-hidden break-all max-w-[450px] cursor-pointer flex flex-col"
                                  :body-style="{
                                    padding: cardBodyPadding,
                                    flex: 1,
                                    display: 'flex',
                                  }"
                                  :data-stack="stack.title"
                                  :data-testid="`nc-gallery-card-${record.row.id}`"
                                  :class="{
                                    'not-draggable': !hasEditPermission || isPublic,
                                    '!cursor-default': !hasEditPermission || isPublic || !interfaceShowRowExpand,
                                    'nc-interface-card-selected': isCardSelected(record),
                                  }"
                                  :style="getCardColorStyle(record)"
                                  @click="expandFormClick($event, record)"
                                  @contextmenu="showContextMenu($event, record)"
                                >
                                  <!--
                                      Check the coverImageColumn ID because kanbanMetaData?.fk_cover_image_col_id
                                      could reference a non-existent column. This is a workaround to handle such scenarios properly.
                                    -->
                                  <template v-if="coverImageColumn?.id" #cover>
                                    <template v-if="isMounted && !reloadAttachments && attachments(record).length">
                                      <a-carousel
                                        :key="attachments(record).reduce((acc, curr) => acc + curr?.path, '')"
                                        class="gallery-carousel !border-b-1 !border-nc-border-gray-medium !bg-nc-bg-default"
                                        arrows
                                      >
                                        <template #customPaging>
                                          <a>
                                            <div>
                                              <div></div>
                                            </div>
                                          </a>
                                        </template>

                                        <template #prevArrow>
                                          <div class="z-10 arrow">
                                            <NcButton
                                              type="secondary"
                                              size="xsmall"
                                              class="!absolute !left-1.5 !bottom-[-90px] !opacity-0 !group-hover:opacity-100 !rounded-lg cursor-pointer"
                                            >
                                              <GeneralIcon icon="arrowLeft" class="text-nc-content-inverted-secondary w-4 h-4" />
                                            </NcButton>
                                          </div>
                                        </template>

                                        <template #nextArrow>
                                          <div class="z-10 arrow">
                                            <NcButton
                                              type="secondary"
                                              size="xsmall"
                                              class="!absolute !right-1.5 !bottom-[-90px] !opacity-0 !group-hover:opacity-100 !rounded-lg cursor-pointer"
                                            >
                                              <GeneralIcon icon="arrowRight" class="text-nc-content-inverted-secondary w-4 h-4" />
                                            </NcButton>
                                          </div>
                                        </template>

                                        <template v-for="attachment in attachments(record)" :key="attachment.path">
                                          <LazyCellAttachmentPreviewThumbnail
                                            :attachment="attachment"
                                            class="h-52"
                                            image-class="!w-full"
                                            thumbnail="card_cover"
                                            :object-fit="coverImageObjectFitStyle"
                                            @click="expandFormClick($event, record)"
                                          />
                                        </template>
                                      </a-carousel>
                                    </template>
                                    <div
                                      v-else
                                      class="h-52 w-full !flex flex-row !border-b-1 !border-nc-border-gray-medium items-center justify-center bg-nc-bg-default"
                                    >
                                      <img class="object-contain w-[48px] h-[48px]" src="~assets/icons/FileIconImageBox.png" />
                                    </div>
                                  </template>
                                  <div class="flex-1 flex content-stretch gap-3 w-full">
                                    <div
                                      v-if="showRecordColorLeftBar"
                                      class="nc-kanban-card-color-bar w-1 flex-none min-h-4 rounded-sm"
                                      :style="extractRowBackgroundColorStyle(record).rowLeftBorderColor"
                                    ></div>
                                    <div
                                      class="flex-1 flex flex-col !children:pointer-events-none"
                                      :class="{
                                        'w-[calc(100%_-_16px)]': showRecordColorLeftBar,
                                        'w-full': !showRecordColorLeftBar,
                                        'gap-3': isActiveViewFieldHeaderVisible,
                                      }"
                                    >
                                      <div
                                        v-if="displayField"
                                        class="flex gap-2 rounded-lg w-full z-1 relative"
                                        :class="getCellColorClass(record, displayField.id)"
                                        :style="getCellColorBgVar(record, displayField.id)"
                                      >
                                        <span
                                          v-if="showRecordColorDot && record.rowMeta?.rowLeftBorderColor"
                                          class="nc-kanban-card-color-dot mt-1.5 h-2 w-2 flex-none rounded-full"
                                          :style="{ backgroundColor: record.rowMeta.rowLeftBorderColor }"
                                        ></span>
                                        <div
                                          v-if="getCellLeftBorderStyle(record, displayField.id)"
                                          class="w-1 flex-none min-h-4 rounded-sm"
                                          :style="getCellLeftBorderStyle(record, displayField.id)"
                                        ></div>
                                        <h2 class="nc-card-display-value-wrapper flex-1 min-w-0 !children:pointer-events-auto">
                                          <template
                                            v-if="!isRowEmpty(record, displayField) || isAllowToRenderRowEmptyField(displayField)"
                                          >
                                            <LazySmartsheetVirtualCell
                                              v-if="isVirtualCol(displayField)"
                                              v-model="record.row[displayField.title]"
                                              class="!text-nc-content-brand"
                                              :column="displayField"
                                              :row="record"
                                            />
                                            <NcTooltip
                                              v-else
                                              class="!w-full max-w-full"
                                              placement="top"
                                              show-on-truncate-only
                                              truncate-selector=".nc-cell-field"
                                              :disabled="!isDisplayFieldTextOrNumber"
                                              :title="`${record.row[displayField.title] ?? ''}`"
                                            >
                                              <LazySmartsheetCell
                                                v-model="record.row[displayField.title]"
                                                class="!text-nc-content-brand"
                                                :column="displayField"
                                                :edit-enabled="false"
                                                :read-only="true"
                                              />
                                            </NcTooltip>
                                          </template>
                                          <template v-else> -</template>
                                        </h2>
                                      </div>

                                      <div
                                        v-for="col in fieldsWithoutDisplay"
                                        :key="`record-${record.row.id}-${col.id}`"
                                        class="nc-card-col-wrapper"
                                        :class="{
                                          '!children:pointer-events-auto': resetPointerEvent(record, col),
                                        }"
                                        @click="handleCellClick(col, $event)"
                                      >
                                        <NcTooltip
                                          hide-on-click
                                          :disabled="isActiveViewFieldHeaderVisible"
                                          class="w-full z-10 flex"
                                          :class="{
                                            'pointer-events-auto': !isActiveViewFieldHeaderVisible,
                                          }"
                                          placement="left"
                                          :arrow="false"
                                        >
                                          <template #title>
                                            <LazySmartsheetHeaderVirtualCell
                                              v-if="isVirtualCol(col)"
                                              :column="col"
                                              :hide-menu="true"
                                              hide-icon-tooltip
                                              class="!text-gray-100 nc-record-cell-tooltip"
                                            />
                                            <LazySmartsheetHeaderCell
                                              v-else
                                              :column="col"
                                              :hide-menu="true"
                                              hide-icon-tooltip
                                              class="!text-gray-100 nc-record-cell-tooltip"
                                            />
                                          </template>

                                          <div
                                            class="flex gap-2 rounded-lg w-full z-1 relative"
                                            :class="{
                                              'pointer-events-none': !resetPointerEvent(record, col),
                                              [getCellColorClass(record, col.id)]: true,
                                            }"
                                            :style="getCellColorBgVar(record, col.id)"
                                          >
                                            <div
                                              v-if="getCellLeftBorderStyle(record, col.id)"
                                              class="w-1 flex-none min-h-4 rounded-sm"
                                              :style="getCellLeftBorderStyle(record, col.id)"
                                            ></div>
                                            <div class="flex flex-col w-full">
                                              <div
                                                v-if="isActiveViewFieldHeaderVisible"
                                                class="flex flex-row w-full justify-start"
                                              >
                                                <div
                                                  class="nc-card-col-header w-full !children:text-nc-content-gray-muted"
                                                  :class="{ 'nc-card-col-header-no-icon': !!interfacePageDataApi }"
                                                >
                                                  <!-- Interface cards label with the field NAME only — no type icon -->
                                                  <LazySmartsheetHeaderVirtualCell
                                                    v-if="isVirtualCol(col)"
                                                    :column="col"
                                                    :hide-menu="true"
                                                    :hide-icon="!!interfacePageDataApi"
                                                  />

                                                  <LazySmartsheetHeaderCell
                                                    v-else
                                                    :column="col"
                                                    :hide-menu="true"
                                                    :hide-icon="!!interfacePageDataApi"
                                                  />
                                                </div>
                                              </div>

                                              <div
                                                v-if="
                                                  !isRowEmpty(record, col) || isAllowToRenderRowEmptyField(col) || isPercent(col)
                                                "
                                                class="flex flex-row w-full text-nc-content-gray items-center justify-start min-h-7 py-1"
                                              >
                                                <LazySmartsheetVirtualCell
                                                  v-if="isVirtualCol(col)"
                                                  v-model="record.row[col.title]"
                                                  :column="col"
                                                  :row="record"
                                                  class="!text-nc-content-gray"
                                                />

                                                <LazySmartsheetCell
                                                  v-else
                                                  v-model="record.row[col.title]"
                                                  :column="col"
                                                  :edit-enabled="false"
                                                  :read-only="true"
                                                  class="!text-nc-content-gray"
                                                />
                                              </div>
                                              <div v-else class="flex flex-row w-full h-7 items-center justify-start">-</div>
                                            </div>
                                          </div>
                                        </NcTooltip>
                                      </div>
                                    </div>
                                  </div>
                                </a-card>
                              </SmartsheetRow>
                              <!-- Placeholder for non-visible cards to maintain scroll height -->
                              <div
                                v-else
                                :style="{
                                  height: `${cardHeight + 8}px`,
                                  pointerEvents: 'none',
                                  flexShrink: 0,
                                }"
                              />
                            </div>
                          </template>
                        </Draggable>

                        <!-- Interface: "New record" flows after the last card (no pinned stack footer) -->
                        <PermissionsTooltip
                          v-if="
                            interfacePageDataApi &&
                            formattedData.get(stack.title)?.length &&
                            isUIAllowed('dataInsert') &&
                            !isSyncedTable &&
                            canAddDeleteRows
                          "
                          :entity="PermissionEntity.TABLE"
                          :entity-id="meta?.id"
                          :permission="PermissionKey.TABLE_RECORD_ADD"
                        >
                          <template #default="{ isAllowed }">
                            <NcButton
                              size="small"
                              type="text"
                              class="nc-kanban-inline-new-record w-full mb-2 !text-nc-content-gray-subtle"
                              :disabled="!isAllowed"
                              data-testid="nc-kanban-stack-inline-new-record"
                              @click="handleOpenNewRecordForm(stack.title)"
                            >
                              <div class="w-full flex items-center gap-2">
                                <component :is="iconMap.plus" class="flex-none w-4 h-4" />

                                {{ $t('activity.newRecord') }}
                              </div>
                            </NcButton>
                          </template>
                        </PermissionsTooltip>

                        <!-- Empty state. Requires loaded data: an unloaded stack rendered mid-drag (skeleton
                             suppressed) isn't known to be empty, so show a plain droppable column instead. -->
                        <div
                          v-if="formattedData.get(stack.title) && !formattedData.get(stack.title)?.length"
                          class="w-full flex flex-col gap-4 items-center justify-center absolute inset-0"
                          :style="{
                            minHeight: '100%',
                            height: '100%',
                          }"
                        >
                          <div class="flex flex-col items-center gap-2 text-nc-content-gray-subtle2 text-center">
                            <span class="text-sm font-semibold">
                              {{ $t('general.empty') }} {{ $t('general.stack').toLowerCase() }}
                            </span>
                            <span class="text-xs font-weight-500">
                              {{ $t('title.looksLikeThisStackIsEmpty') }}
                            </span>
                          </div>
                          <PermissionsTooltip
                            v-if="isUIAllowed('dataInsert') && !isSyncedTable && canAddDeleteRows"
                            :entity="PermissionEntity.TABLE"
                            :entity-id="meta?.id"
                            :permission="PermissionKey.TABLE_RECORD_ADD"
                            placement="right"
                          >
                            <template #default="{ isAllowed }">
                              <NcButton
                                size="xs"
                                type="secondary"
                                :disabled="!isAllowed"
                                @click="handleOpenNewRecordForm(stack.title)"
                              >
                                <div class="flex items-center gap-2">
                                  <component :is="iconMap.plus" v-if="!isPublic && !isLocked" />

                                  {{ $t('activity.newRecord') }}
                                </div>
                              </NcButton>
                            </template>
                          </PermissionsTooltip>
                        </div>
                      </div>
                    </a-layout-content>
                    <!-- Interface pages have no pinned footer — "New record" rides inline after the last card -->
                    <a-layout-footer
                      v-if="formattedData.get(stack.title) && !interfacePageDataApi"
                      class="border-t-1 border-nc-border-gray-light"
                    >
                      <div class="flex items-center justify-between">
                        <PermissionsTooltip
                          v-if="isUIAllowed('dataInsert') && !isSyncedTable && canAddDeleteRows"
                          :entity="PermissionEntity.TABLE"
                          :entity-id="meta?.id"
                          :permission="PermissionKey.TABLE_RECORD_ADD"
                        >
                          <template #default="{ isAllowed }">
                            <NcButton
                              size="xs"
                              type="secondary"
                              :disabled="!isAllowed"
                              @click="handleOpenNewRecordForm(stack.title)"
                            >
                              <div class="flex items-center gap-2">
                                <component :is="iconMap.plus" v-if="!isPublic && !isLocked" class="" />

                                {{ $t('activity.newRecord') }}
                              </div>
                            </NcButton>
                          </template>
                        </PermissionsTooltip>
                        <div v-else>&nbsp;</div>

                        <!-- Record Count — on interface pages the total rides the stack header instead. -->
                        <div
                          v-if="!interfacePageDataApi"
                          class="nc-kanban-data-count text-nc-content-gray-muted font-weight-500 px-1"
                        >
                          {{ formattedData.get(stack.title)!.length }}/{{ countByStack.get(stack.title) ?? 0 }}
                          {{ countByStack.get(stack.title) !== 1 ? $t('objects.records') : $t('objects.record') }}
                        </div>
                      </div>
                    </a-layout-footer>
                  </a-layout>
                </a-card>

                <!-- Collapsed Stacks -->
                <a-card
                  v-else
                  :key="`${stack.id}-collapsed`"
                  class="nc-kanban-collapsed-stack flex items-center w-68.5 !rounded-xl cursor-pointer h-full !p-2 overflow-hidden !shadow-none !hover:shadow-none !border-nc-border-gray-medium"
                  :class="{
                    'not-draggable': stack.title === null || isLocked || isPublic || !hasEditPermission,
                    'nc-kanban-collapsed-stack-reading-down': !!interfacePageDataApi,
                    'h-[52px]': !!interfacePageDataApi,
                    'h-[44px]': !interfacePageDataApi,
                  }"
                  :body-style="{
                    padding: '0px !important',
                    height: '100%',
                    width: '100%',
                    borderRadius: '0.75rem !important',
                    paddingBottom: '0rem !important',
                  }"
                  @mouseenter="handleCollapsedStackDragEnter(stack)"
                  @dragenter="handleCollapsedStackDragEnter(stack)"
                >
                  <div
                    class="h-full flex items-center justify-between"
                    @click="handleCollapsedStackClick(stack, getAbsStackIdx(relStackIdx))"
                  >
                    <div
                      v-if="!formattedData.get(stack.title) || !countByStack"
                      class="!w-full !h-full flex items-center justify-center"
                    >
                      <a-skeleton-input :active="true" class="!w-full !h-4 !rounded-lg overflow-hidden" />
                    </div>
                    <div v-else class="nc-kanban-stack-head w-full flex items-center justify-between gap-2">
                      <div class="flex items-center gap-1">
                        <NcButton
                          v-if="!(isLocked || isPublic || !hasEditPermission || interfacePageDataApi)"
                          :disabled="!stack.title"
                          type="text"
                          size="xs"
                          class="nc-kanban-stack-drag-handler !px-1.5 !cursor-move"
                          @click.stop
                        >
                          <GeneralIcon icon="ncDrag" class="font-weight-800 flex-none" />
                        </NcButton>

                        <!-- Interfaces show a bare count, freeing most of the bar for the title. -->
                        <div class="flex-1 flex" :class="interfacePageDataApi ? 'max-w-[170px]' : 'max-w-[115px]'">
                          <a-tag
                            class="max-w-full !rounded-full !px-2 !py-1 h-7 !m-0 !border-none"
                            :color="
                              getSelectTypeFieldOptionBgColor({
                                color: stack.color || '#ccc',
                                isDark,
                                getColor,
                                isColorCodeEnabled,
                              })
                            "
                          >
                            <span
                              :style="{
                                color: getSelectTypeFieldOptionTextColor({
                                  color: stack.color || '#ccc',
                                  isDark,
                                  getColor,
                                  isColorCodeEnabled,
                                }),
                              }"
                              class="text-sm font-semibold"
                            >
                              <NcTooltip class="truncate max-w-full" placement="left" show-on-truncate-only>
                                <template #title>
                                  {{ stack.title ?? $t('labels.uncategorized') }}
                                </template>
                                <span
                                  data-testid="nc-kanban-stack-title"
                                  class="text-ellipsis overflow-hidden"
                                  :style="{
                                    wordBreak: 'keep-all',
                                    whiteSpace: 'nowrap',
                                    display: 'inline',
                                  }"
                                >
                                  {{ stack.title ?? $t('labels.uncategorized') }}
                                </span>
                              </NcTooltip>
                            </span>
                          </a-tag>
                        </div>
                      </div>

                      <div class="flex items-center gap-2 truncate">
                        <div
                          class="nc-kanban-data-count px-1 rounded bg-nc-bg-gray-medium text-nc-content-gray text-sm font-weight-500 truncate"
                          :style="{ 'word-break': 'keep-all', 'white-space': 'nowrap' }"
                        >
                          <!-- Record Count (interfaces: bare number) -->
                          {{ formattedData.get(stack.title)!.length }}
                          <template v-if="!interfacePageDataApi">
                            {{ countByStack.get(stack.title) !== 1 ? $t('objects.records') : $t('objects.record') }}
                          </template>
                        </div>

                        <NcButton type="text" size="xs" class="!px-1.5">
                          <component :is="iconMap.arrowDown" class="h-4 w-4 flex-none opacity-75" />
                        </NcButton>
                      </div>
                    </div>
                  </div>
                </a-card>
              </div>
            </template>
          </Draggable>

          <!-- Right spacer standing in for off-screen stacks (horizontal virtual scroll) -->
          <div
            v-if="rightStackSpacerWidth"
            class="flex-none"
            :style="{ width: `${rightStackSpacerWidth}px` }"
            aria-hidden="true"
          />

          <!-- Adding a stack writes a new select option onto the stacking FIELD
               (columnUpdate — creator+ server-side), not a record -->
          <div
            v-if="isUIAllowed('fieldAdd') && hasEditPermission && !isPublic && !isLocked && groupingFieldColumn?.id"
            class="nc-kanban-add-new-stack"
          >
            <!-- Add New Stack -->
            <a-card
              class="flex flex-col !rounded-xl overflow-y-hidden !shadow-none !hover:shadow-none border-nc-border-gray-medium nc-kanban-stack-header-new-stack"
              :class="[
                compareStack(addNewStackObj, isRenameOrNewStack) ? 'w-68.5' : 'w-fit',
                {
                  '!cursor-default': isLocked || !hasEditPermission,
                  '!border-none': !compareStack(addNewStackObj, isRenameOrNewStack),
                },
              ]"
              :head-style="{ paddingBottom: '0px' }"
              :body-style="{
                padding: '0px !important',
                height: '100%',
                borderRadius: '0.75rem !important',
                paddingBottom: '0rem !important',
              }"
            >
              <!-- Skeleton -->
              <div v-if="!formattedData.get(null) || !countByStack" class="mt-2.5 px-3 !w-full">
                <a-skeleton-input :active="true" class="!w-full !h-9.75 !rounded-lg overflow-hidden" />
              </div>

              <!-- Stack -->
              <a-layout v-else>
                <a-layout-header
                  :class="{
                    '!p-0 overflow-hidden': !compareStack(addNewStackObj, isRenameOrNewStack),
                  }"
                >
                  <div
                    class="w-full flex"
                    :class="{
                      'items-start': compareStack(addNewStackObj, isRenameOrNewStack),
                      'cursor-pointer': !compareStack(addNewStackObj, isRenameOrNewStack),
                    }"
                    @click="
                      () => {
                        if (!compareStack(addNewStackObj, isRenameOrNewStack)) {
                          isRenameOrNewStack = addNewStackObj
                        }
                      }
                    "
                  >
                    <NcTooltip
                      v-if="!compareStack(addNewStackObj, isRenameOrNewStack)"
                      :title="`${$t('general.new')} ${$t('general.stack').toLowerCase()}`"
                      placement="top"
                    >
                      <NcButton
                        type="secondary"
                        class="add-new-stack-btn !rounded-xl !w-11 !h-11 !min-h-11 !px-0"
                        data-testid="nc-kanban-add-new-stack-btn"
                      >
                        <component :is="iconMap.plus" class="w-4 h-4" />
                      </NcButton>
                    </NcTooltip>

                    <div
                      v-else
                      class="flex-1 flex"
                      :class="{
                        '-ml-1': compareStack(addNewStackObj, isRenameOrNewStack),
                      }"
                      @click.stop
                    >
                      <template
                        v-if="compareStack(addNewStackObj, isRenameOrNewStack) && metaColumnById[groupingFieldColumn?.id]"
                      >
                        <SmartsheetKanbanEditOrAddStack
                          :column="metaColumnById[groupingFieldColumn?.id]"
                          is-new-stack
                          @submit="(loadMeta) => handleSubmitRenameOrNewStack(loadMeta, undefined)"
                        />
                      </template>
                    </div>
                  </div>
                </a-layout-header>
              </a-layout>
            </a-card>
          </div>
        </div>
        <!-- Drop down Menu -->
        <template v-if="!isLocked && !isPublic && (hasEditPermission || interfacePageDataApi)" #overlay>
          <NcMenu
            :class="interfacePageDataApi ? '!rounded-lg nc-interface-card-context-menu' : ''"
            :variant="interfacePageDataApi ? 'medium' : 'small'"
            @click="contextMenu = false"
          >
            <NcMenuItem
              v-if="contextMenuTarget && canDuplicateRow"
              data-testid="nc-interface-kanban-menu-duplicate"
              @click="interfaceDuplicateRow"
            >
              <div v-e="['c:interface:kanban:record:duplicate']" class="flex items-center gap-2 nc-kanban-context-menu-item">
                <GeneralIcon icon="duplicate" class="flex" />
                {{ $t('labels.duplicateRecord') }}
              </div>
            </NcMenuItem>
            <NcMenuItem
              v-if="contextMenuTarget && interfaceClickIntoDetails"
              v-e="['a:kanban:expand-record']"
              @click="expandForm(contextMenuTarget)"
            >
              <div class="flex items-center gap-2 nc-kanban-context-menu-item">
                <component :is="iconMap.maximize" class="flex" />
                <!-- Expand Record -->
                {{ $t('activity.expandRecord') }}
              </div>
            </NcMenuItem>
            <!-- Send record is collaborator/data-app vocabulary — hidden on interface pages -->
            <NcMenuItem
              v-if="contextMenuTarget && contextMenuRowId && !isPublic && appInfo.ee && !interfacePageDataApi"
              @click="showSendRecordModal = true"
            >
              <div class="flex items-center gap-2 nc-kanban-context-menu-item">
                <GeneralIcon icon="mail" class="flex" />
                {{ $t('activity.sendRecord') }}
              </div>
            </NcMenuItem>
            <template v-if="interfacePageDataApi && contextMenuRowId">
              <NcDivider v-if="contextMenuTarget && (canDuplicateRow || interfaceClickIntoDetails)" />
              <NcMenuItem data-testid="nc-interface-kanban-menu-copy-url" @click="interfaceCopyRecordUrl">
                <div v-e="['c:interface:kanban:record:copy-url']" class="flex items-center gap-2 nc-kanban-context-menu-item">
                  <GeneralIcon icon="ncLink" class="flex" />
                  {{ $t('labels.copyRecordURL') }}
                </div>
              </NcMenuItem>
            </template>
            <NcDivider v-if="canAddDeleteRows" />
            <PermissionsTooltip
              v-if="contextMenuTarget && canAddDeleteRows"
              :entity="PermissionEntity.TABLE"
              :entity-id="meta?.id"
              :permission="PermissionKey.TABLE_RECORD_DELETE"
              placement="right"
            >
              <template #default="{ isAllowed }">
                <NcMenuItem v-e="['a:kanban:delete-record']" danger :disabled="!isAllowed" @click="deleteRow(contextMenuTarget)">
                  <div class="flex items-center gap-2 nc-kanban-context-menu-item">
                    <GeneralIcon icon="delete" class="flex" />
                    <!-- Delete Record -->
                    {{
                      $t('general.deleteEntity', {
                        entity: $t('objects.record').toLowerCase(),
                      })
                    }}
                  </div>
                </NcMenuItem>
              </template>
            </PermissionsTooltip>
          </NcMenu>
        </template>
      </NcDropdown>
    </div>
  </div>

  <SmartsheetExpandedForm
    v-if="expandedFormRow && expandedFormDlg"
    v-model="expandedFormDlg"
    :row="expandedFormRow"
    :state="expandedFormRowState"
    :meta="meta"
    :load-row="!isPublic"
    :view="view"
    :allow-null-field-ids="groupingFieldColumn?.id ? [groupingFieldColumn.id] : []"
    @cancel="removeRowFromUncategorizedStack"
  />

  <SmartsheetExpandedForm
    v-if="expandedFormOnRowIdDlg && meta?.id"
    v-model="expandedFormOnRowIdDlg"
    :load-row="!isPublic"
    :row="expandedFormRow ?? { row: {}, oldRow: {}, rowMeta: {} }"
    :meta="meta"
    :expand-form="expandForm"
    :row-id="route.query.rowId"
    :view="view"
    :allow-null-field-ids="groupingFieldColumn?.id ? [groupingFieldColumn.id] : []"
  />

  <GeneralDeleteModal
    v-model:visible="deleteStackVModel"
    :entity-name="$t('general.stack')"
    :show-default-delete-msg="false"
    :on-delete="handleDeleteStackConfirmClick"
  >
    <template #entity-preview>
      <div v-if="stackToBeDeleted" class="text-nc-content-gray flex flex-col gap-3">
        <i18n-t keypath="msg.info.deleteStackRemovesOption" tag="div">
          <template #stackToBeDeleted>
            <b>"{{ stackToBeDeleted }}"</b>
          </template>
          <template #groupingField>
            <b>"{{ groupingFieldColumn?.title ?? $t('labels.grouping') }}"</b>
          </template>
        </i18n-t>
        <div>{{ $t('msg.info.recordsMovedToUncategorizedStack') }}</div>
      </div>
    </template>
  </GeneralDeleteModal>

  <DlgSendRecordEmail v-model="showSendRecordModal" :meta="meta" :view="view" :row-id="contextMenuRowId" />
</template>

<style lang="scss" scoped>
.nc-interface-card-context-menu {
  // Target the inner wrapper — it carries its own `text-sm`, so a size set on
  // the item element would lose to it via inheritance.
  :deep(.nc-menu-item-inner) {
    @apply text-[13px];

    svg {
      @apply w-3.5 h-3.5;
    }
  }
}

// override ant design style
.a-layout,
.ant-layout-header,
.ant-layout-footer {
  @apply !bg-nc-bg-default;
}

.ant-layout-content {
  background-color: unset;
}

.ant-layout-header,
.ant-layout-footer {
  @apply p-2 text-sm;
  height: unset !important;
}

.nc-kanban-collapsed-stack {
  transform: rotate(-90deg) translateX(-100%);
  transform-origin: left top 0px;
  transition: left 0.2s ease-in-out 0s;
}

// Interfaces read collapsed stacks TOP-TO-BOTTOM (reference design) — the
// +90deg/translateY pair occupies the exact same 52px strip as the base.
// The card itself is transparent: the STRIP (the full-height stack wrapper
// below) carries the gray fill, so the column is one shade from the header
// down to the frame bottom (the base keeps its white bordered card look).
.nc-kanban-collapsed-stack-reading-down {
  transform: rotate(90deg) translateY(-100%);
  @apply !bg-transparent !border-none !rounded-none;
}

// One flat gray column per collapsed strip — the theme's full-height
// .nc-kanban-stack border-right is the only divider between strips, so the
// seam line runs unbroken instead of stopping where the rotated card ends.
.nc-kanban-stack-interface-collapsed {
  background: var(--nc-bg-gray-light);
}

:deep(.slick-dots li button) {
  @apply !bg-black;
}

.ant-carousel.gallery-carousel :deep(.slick-dots) {
  @apply !w-full max-w-[calc(100%_-_36%)] absolute left-0 right-0 bottom-[-18px] h-6 overflow-x-auto nc-scrollbar-thin !mx-auto;
}

.ant-carousel.gallery-carousel :deep(.slick-dots li div > div) {
  @apply rounded-full border-0 cursor-pointer block opacity-100 p-0 outline-none transition-all duration-500 text-transparent h-2 w-2 bg-nc-bg-gray-medium;
  font-size: 0;
}

.ant-carousel.gallery-carousel :deep(.slick-dots li.slick-active div > div) {
  @apply bg-nc-content-brand opacity-100;
}

.ant-carousel.gallery-carousel :deep(.slick-dots li) {
  @apply !w-auto;
}

.ant-carousel.gallery-carousel :deep(.slick-prev) {
  @apply left-0;
}

.ant-carousel.gallery-carousel :deep(.slick-next) {
  @apply right-0;
}

:deep(.slick-slide) {
  @apply !pointer-events-none;
}

:deep(.ant-card) {
  @apply transition-shadow duration-0.3s;

  box-shadow: 0px 2px 4px -2px rgba(0, 0, 0, 0.06), 0px 4px 4px -2px rgba(0, 0, 0, 0.02);

  &:hover {
    box-shadow: 0px 12px 16px -4px rgba(0, 0, 0, 0.1), 0px 4px 6px -2px rgba(0, 0, 0, 0.06);

    .nc-action-icon {
      @apply invisible;
    }
  }
}

.nc-card-display-value-wrapper {
  @apply my-0 text-subHeading2 text-nc-content-gray-subtle2;

  :deep(.nc-cell),
  :deep(.nc-virtual-cell) {
    @apply text-subHeading2;

    .nc-cell-field,
    input,
    textarea,
    .nc-cell-field-link {
      @apply !text-subHeading2 text-nc-content-gray-subtle2;

      &:not(.ant-select-selection-search-input) {
        @apply !text-subHeading2 text-nc-content-gray-subtle2;
      }
    }
  }
}

.nc-card-col-wrapper {
  @apply !text-small !leading-[18px];

  .nc-cell,
  .nc-virtual-cell {
    @apply !text-small !leading-[18px];

    :deep(.nc-cell-field),
    :deep(input),
    :deep(textarea),
    :deep(.nc-cell-field-link) {
      @apply !text-small leading-[18px];

      &:not(.ant-select-selection-search-input) {
        @apply !text-small leading-[18px];
      }
    }
  }
}

.nc-card-col-header {
  :deep(.nc-cell-icon),
  :deep(.nc-virtual-cell-icon) {
    @apply ml-0 !w-3.5 !h-3.5;
  }
}

// Icon hidden (interface) — drop the name's icon-gap padding (left in LTR,
// right in RTL) so the label aligns with the value rendered below it.
.nc-card-col-header-no-icon {
  :deep(.name) {
    padding-left: 0;
    padding-right: 0;
  }
}

:deep(.nc-cell) {
  &.nc-cell-longtext {
    .long-text-wrapper {
      @apply min-h-1;
      .nc-readonly-rich-text-wrapper {
        @apply !min-h-1;
      }

      .nc-rich-text {
        @apply pl-0;
        .tiptap.ProseMirror {
          @apply -ml-1 min-h-1;
        }
      }
    }
  }

  &.nc-cell-checkbox {
    @apply children:pl-0;
  }

  &.nc-cell-singleselect .nc-cell-field > div {
    @apply flex items-center;
  }

  &.nc-cell-multiselect .nc-cell-field > div {
    @apply h-5;
  }

  &.nc-cell-email,
  &.nc-cell-phonenumber {
    @apply flex items-center;
  }

  &.nc-cell-email,
  &.nc-cell-phonenumber,
  &.nc-cell-url {
    .nc-cell-field-link {
      @apply py-0;
    }
  }
  &.nc-cell-datetime {
    @apply !w-auto;
    & > div {
      @apply !w-auto;
    }
    div {
      @apply flex-none !max-w-none !w-auto;
    }
  }

  .nc-date-picker > div > div {
    &:first-child {
      @apply pl-0;
    }

    &:last-child {
      @apply pr-0;
    }
  }
}

:deep(.nc-virtual-cell) {
  .nc-links-wrapper {
    @apply py-0 children:min-h-4;
  }

  &.nc-virtual-cell-linktoanotherrecord {
    .chips-wrapper {
      @apply min-h-4 !children:min-h-4;
      .chip.group {
        @apply my-0;
      }
    }
  }

  &.nc-virtual-cell-lookup {
    .nc-lookup-cell {
      &:has(.nc-attachment-wrapper) {
        @apply !h-auto;

        .nc-attachment-cell {
          @apply !h-auto;

          .nc-attachment-wrapper {
            @apply py-0;
          }
        }
      }

      &:not(:has(.nc-attachment-wrapper)) {
        @apply !h-5.5;
      }

      .nc-cell-lookup-scroll {
        @apply py-0 h-auto;
      }
    }
  }

  &.nc-virtual-cell-formula {
    .nc-cell-field {
      @apply py-0;
    }
  }

  &.nc-virtual-cell-qrcode,
  &.nc-virtual-cell-barcode {
    @apply children:justify-start;
  }

  .nc-date-picker > div > div {
    &:first-child {
      @apply pl-0;
    }

    &:last-child {
      @apply pr-0;
    }
  }
}
.nc-record-cell-tooltip {
  @apply !bg-transparent !hover:bg-transparent;
  :deep(.nc-cell-icon) {
    @apply !ml-0 h-3.5 w-3.5;
  }
  :deep(.name) {
    @apply text-captionSm;
  }
  :deep(.nc-cell-name-wrapper),
  :deep(.nc-virtual-cell-name-wrapper) {
    @apply !max-w-full;
  }
}

.has-cell-bg-color {
  &::before {
    content: '';
    @apply absolute inset-0 -left-1 rounded-lg -z-1;
    background-color: var(--cell-bg-color);
  }
}
// Compound + :hover so the selection outlives the card's own hover styling.
.ant-card.nc-interface-card-selected,
.ant-card.nc-interface-card-selected:hover {
  border-color: var(--nc-border-brand) !important;
}

// Interface stack-header actions (collapse / menu): hover-revealed. Stay
// visible while the context menu is open (ant stamps the trigger) or on
// keyboard focus.
.nc-kanban-stack-hover-action {
  opacity: 0;
  transition: opacity 0.15s;

  &:focus-visible,
  &.ant-dropdown-open {
    opacity: 1;
  }
}

.nc-kanban-stack-head:hover .nc-kanban-stack-hover-action {
  opacity: 1;
}
</style>
