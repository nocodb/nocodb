<script setup lang="ts">
import {
  type ColumnType,
  type InterfaceGalleryVizTheme,
  PermissionEntity,
  PermissionKey,
  UITypes,
  ViewTypes,
  isVirtualCol,
} from 'nocodb-sdk'
import type { Attachment } from '../../lib/types'
import type { Row as RowType } from '#imports'
import { NavigateDir } from '#imports'

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())
const reloadViewMetaHook = inject(ReloadViewMetaHookInj)
const reloadViewDataHook = inject(ReloadViewDataHookInj)
const { withLoading } = useLoadingTrigger()

const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())
const isPublic = inject(IsPublicInj, ref(false))
const fields = inject(FieldsInj, ref([]))

const { appInfo, user } = useGlobal()
const { isViewDataLoading, isActiveViewFieldHeaderVisible: storeFieldHeaderVisible } = storeToRefs(useViewsStore())

const { isSqlView, xWhere, isExternalSource, isSyncedTable, allFilters, validFiltersFromUrlParams, eventBus } =
  useSmartsheetStoreOrThrow()
const { isUIAllowed } = useRoles()
const route = useRoute()
const router = useRouter()

const { showRecordPlanLimitExceededModal, blockExternalSourceRecordVisibility, showAsBluredRecord } = useEeConfig()

const expandedFormDlg = ref(false)
const expandedFormRow = ref<RowType>()
const expandedFormRowState = ref<Record<string, any>>()

provide(IsFormInj, ref(false))
provide(IsGalleryInj, ref(true))
provide(IsGridInj, ref(false))
provide(IsCalendarInj, ref(false))
provide(RowHeightInj, ref(1 as const))
provide(ReloadRowDataHookInj, reloadViewDataHook!)

const { isMounted } = useIsMounted()

const {
  fetchChunk,
  deleteRow,
  insertRow,
  syncCount,
  navigateToSiblingRow,
  chunkStates,
  cachedRows,
  totalRows: _totalRows,
  isFirstRow,
  isLastRow,
  clearCache,
  viewData: galleryData,
} = useGalleryViewData(meta, view, xWhere)

const { copy } = useCopy()

const { t } = useI18n()

// Interface pages read the label toggle LIVE off the synthetic view meta (the
// store computed can hold a stale sharedView ref across in-session remounts —
// same local pattern as hideEmptyCardFields / cover-fit below).
const interfacePageDataApi = inject(InterfacePageDataInj, undefined)

// Whether the interface viz opens records — gates the context-menu Expand item.
const interfaceClickIntoDetails = inject(InterfaceClickIntoDetailsInj, ref(true))

// Interface pages open their record-detail sheet instead of the expanded form.
const interfaceExpandRecord = inject(InterfaceExpandRecordInj, undefined)

// Pointer affordance — cards drop the pointer cursor when a click neither
// opens the record nor (builder) prompts to enable click-into-details.
const interfaceShowRowExpand = inject(InterfaceShowRowExpandInj, ref(true))

/**
 * Gallery surface theme (interface pages only). `card` — the default and the
 * data-app look — keeps cover-on-top cards; `poster` turns the tile into the
 * image itself (overlay title / record-color wash).
 */
const interfaceGalleryTheme = inject(InterfaceGalleryThemeInj, undefined)

const isActiveViewFieldHeaderVisible = computed(() => {
  if (interfacePageDataApi) return parseProp(galleryData.value?.meta)?.is_field_header_visible ?? true

  return storeFieldHeaderVisible.value
})

const totalRows = computed(() => {
  if (blockExternalSourceRecordVisibility(isExternalSource.value)) return Math.min(200, _totalRows.value)

  return _totalRows.value
})

// Interface gallery appearance keys stamped on the synthetic view's meta
// (title field/size, pinned column count) — undefined outside interfaces.
const interfaceGalleryMeta = computed(() => (interfacePageDataApi ? parseProp(galleryData.value?.meta) : undefined))

// Resolved card theme — `card` outside interface pages keeps the data-app
// treatment untouched. Surface-only: never fields, ordering or color meaning.
const galleryCardTheme = computed<InterfaceGalleryVizTheme>(() =>
  interfacePageDataApi ? interfaceGalleryTheme?.value ?? 'card' : 'card',
)

const isPosterTheme = computed(() => galleryCardTheme.value === 'poster')

const isMinimalTheme = computed(() => galleryCardTheme.value === 'minimal')

const isSimpleTheme = computed(() => galleryCardTheme.value === 'simple')

// Image-tile themes share the poster markup: the card IS the image, body
// fields never render. Poster keeps its fixed 4:5; minimal/simple follow the
// interface aspect ratio (16:10 when none).
const isTileTheme = computed(() => isPosterTheme.value || isMinimalTheme.value || isSimpleTheme.value)

const displayField = computed(() => {
  // Interface galleries can point the card title at any column — falls back
  // to the classic display-value title.
  const titleFieldId = interfaceGalleryMeta.value?.title_field_id
  if (titleFieldId) {
    const custom = meta.value?.columns?.find((c) => c.id === titleFieldId)
    if (custom) return custom
  }

  return meta.value?.columns?.find((c) => c.pv && fields.value.includes(c)) ?? null
})

// The title column never repeats in the card body.
const fieldsWithoutDisplay = computed(() => fields.value.filter((f) => !isPrimary(f) && f.id !== displayField.value?.id))

const cardTitleSize = computed(() => interfaceGalleryMeta.value?.title_size ?? 'small')

// Card-title tooltip is only meaningful for non-virtual text / number display values (the ones that overflow).
const isDisplayFieldTextOrNumber = computed(() => isTextOrNumberColumn(displayField.value))

const coverImageColumn: any = computed(() =>
  meta.value?.columnsById
    ? meta.value.columnsById[galleryData.value?.fk_cover_image_col_id as keyof typeof meta.value.columnsById]
    : {},
)

const coverImageObjectFitStyle = computed(() => {
  const fk_cover_image_object_fit = parseProp(galleryData.value?.meta)?.fk_cover_image_object_fit || CoverImageObjectFit.FIT
  if (fk_cover_image_object_fit === CoverImageObjectFit.FIT) return 'contain'
  if (fk_cover_image_object_fit === CoverImageObjectFit.COVER) return 'cover'
})

// Classic cover-on-top slot — tile themes own their full-bleed cover markup.
const showCover = computed(() => !isTileTheme.value && !!galleryData.value?.fk_cover_image_col_id)

/** `simple` tiles: one field under the overlaid title. */
const secondaryField = computed(() => {
  if (!isSimpleTheme.value) return null
  const id = interfaceGalleryMeta.value?.secondary_field_id
  if (!id || id === displayField.value?.id) return null
  return meta.value?.columns?.find((c) => c.id === id) ?? null
})

const cardBodyPadding = computed(() => (isTileTheme.value ? '0 !important' : '12px !important'))

const isReadonly = inject(ReadonlyInj, ref(false))

const hasEditPermission = computed(() => isUIAllowed('dataEdit') && (!interfacePageDataApi || !isReadonly.value))

/** Interface pages gate add/delete on the viz opt-in (Kanban parity). */
const canAddDeleteRows = computed(
  () => isUIAllowed('dataEdit') && (!interfacePageDataApi || interfacePageDataApi.canAddDeleteInline.value),
)

/** Interface-only: duplicate rides the add/delete opt-in like the grid record menu. */
const canDuplicateRow = computed(
  () => !!interfacePageDataApi && canAddDeleteRows.value && isUIAllowed('dataEdit') && !isSyncedTable.value,
)

// TODO: extract this code (which is duplicated in grid and gallery) into a separate component
const _contextMenu = ref(false)

const contextMenuTarget = ref<{ row: RowType; index: number } | null>(null)

const contextMenu = computed({
  get: () => _contextMenu.value,
  set: (val) => {
    // Every item is a record operation — a right-click that didn't land on a
    // card (empty gallery area) must not open the menu at all: without the
    // capture-phase target reset below it would show the PREVIOUS card's ops.
    if (val && !contextMenuTarget.value) return

    // Interface pages keep the menu for permission-free items (expand, copy URL).
    if (hasEditPermission.value || interfacePageDataApi) {
      _contextMenu.value = val
    }
  },
})

/**
 * Capture-phase reset for every right-click on the gallery: a card's own
 * @contextmenu (bubble phase) re-sets the target BEFORE ant's dropdown
 * trigger opens the menu, so only card clicks ever have one.
 */
function resetContextMenuTarget() {
  contextMenuTarget.value = null
}

const showSendRecordModal = ref(false)

const contextMenuRowId = computed(() => {
  if (!contextMenuTarget.value?.row) return null
  return extractPkFromRow(contextMenuTarget.value.row.row, meta.value?.columns)
})

const showContextMenu = (e: MouseEvent, target?: { row: RowType; index: number }) => {
  if (isSqlView.value) return
  e.preventDefault()
  if (target) {
    contextMenuTarget.value = target
  }
}

/** Interface: duplicate the right-clicked card, inserting directly below it. */
async function interfaceDuplicateRow() {
  const target = contextMenuTarget.value
  if (!target || !canDuplicateRow.value) return

  // Clone the record's values (identity markers + system columns stripped) so the
  // insert creates a brand-new record. Prompts when the record holds links the copy
  // can't share, and returns null if that prompt was dismissed.
  const clonedData = await prepareDuplicateRowData(target.row.row, meta.value?.columns as ColumnType[])
  if (!clonedData) return

  // `before` is the pk of the card one position down, so the copy lands right
  // after the original (grid record-menu parity).
  const rowBelow = cachedRows.value.get(target.index + 1)
  const beforeRowId = rowBelow ? extractPkFromRow(rowBelow.row, meta.value?.columns as ColumnType[]) : undefined

  const newRow: RowType = { row: clonedData, oldRow: {}, rowMeta: { new: true, rowIndex: target.index + 1 } }

  const inserted = await insertRow(newRow, {}, {}, false, beforeRowId)
  if (inserted) message.toast(t('msg.success.rowDuplicated'))
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

// Parse-per-call is too hot for the tile themes: a single card reads its cover
// up to seven times (theme class, cover branch, caption anchor, scrim, ...) and
// the whole visible slice re-renders on every scroll frame. Keyed on the raw
// cell value, so a row whose attachment value is replaced re-parses.
const attachmentCache = new WeakMap<object, { raw: unknown; parsed: Attachment[] }>()

const attachments = (record: any): Attachment[] => {
  const raw = coverImageColumn.value?.title ? record.row[coverImageColumn.value.title] : undefined
  if (!raw) return []

  const cached = attachmentCache.get(record)
  if (cached && cached.raw === raw) return cached.parsed

  let parsed: Attachment[] = []

  try {
    const att = typeof raw === 'string' ? JSON.parse(raw) : raw

    if (Array.isArray(att)) {
      parsed = att
        .flat()
        .map((a) => (typeof a === 'string' ? JSON.parse(a) : a))
        .filter((a) => a && !Array.isArray(a) && typeof a === 'object' && Object.keys(a).length)
    }
  } catch (e) {
    parsed = []
  }

  attachmentCache.set(record, { raw, parsed })

  return parsed
}

const expandedFormOnRowIdDlg = computed({
  get() {
    return !!route.query.rowId
  },
  set(val) {
    if (!val)
      router.push({
        query: {
          ...route.query,
          rowId: undefined,
        },
      })
  },
})

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
        ...route.query,
        rowId,
      },
    })
  } else {
    expandedFormRow.value = row
    expandedFormDlg.value = true
  }
}

const expandFormClick = async (e: MouseEvent, row: RowType) => {
  const target = e.target as HTMLElement
  if (target.closest('.arrow') || target.closest('.slick-dots')) return
  expandForm(row)
}

const openNewRecordFormHookHandler = async () => {
  const rowFilters = getPlaceholderNewRow(
    [...allFilters.value, ...validFiltersFromUrlParams.value],
    meta.value?.columns as ColumnType[],
    {
      currentUser: user.value ?? undefined,
    },
  )

  expandForm({
    row: { ...rowDefaultData(meta.value?.columns, user.value ?? undefined), ...rowFilters },
    oldRow: {},
    rowMeta: { new: true },
  })
}

const handleClick = (col, event) => {
  if (isButton(col)) {
    event.stopPropagation()
  }
}

openNewRecordFormHook?.on(openNewRecordFormHookHandler)

const reloadAttachments = ref(false)

const reloadViewMetaListener = async () => {
  reloadAttachments.value = true

  await nextTick(() => {
    reloadAttachments.value = false
  })
}

reloadViewMetaHook?.on(reloadViewMetaListener)

const CHUNK_SIZE = 50
const BUFFER_SIZE = 100
const PREFETCH_THRESHOLD = 30

const FIELD_HEIGHT = {
  [UITypes.LongText]: 150,
  [UITypes.Attachment]: 56,
  default: 44,
}

const scrollContainer = ref()

const scrollTop = ref(0)

const rowSlice = reactive({
  start: 0,
  end: 12,
})

const { width: scrollContainerWidth } = useElementSize(scrollContainer)

const CARD_MIN_WIDTH = 250

// Interface `columns_per_row` (1-6) pins the grid; 'auto'/absent keeps the
// classic width-based auto-fit tracks.
const fixedColumnsPerRow = computed(() => {
  const raw = interfaceGalleryMeta.value?.columns_per_row
  return typeof raw === 'number' && raw >= 1 ? Math.min(6, Math.floor(raw)) : null
})

const columnsPerRow = computed(() => {
  if (fixedColumnsPerRow.value) return fixedColumnsPerRow.value

  // Mirrors the CSS `repeat(auto-fit, minmax(CARD_MIN_WIDTH, 1fr))` track math
  // (12px gap + 12px padding each side): 2 columns fit once the container
  // exceeds 2 tracks + chrome, then one more per track + gap.
  const singleColumnCutoff = CARD_MIN_WIDTH * 2 + 37
  if (scrollContainerWidth.value <= singleColumnCutoff) return 1
  return Math.floor((scrollContainerWidth.value - singleColumnCutoff) / (CARD_MIN_WIDTH + 12)) + 2
})

// Card width mirrors the CSS track math (12px container padding each side +
// 12px gaps); auto-fit tracks keep the card's 450px cap. ≤0 until the
// container is measured.
const cardWidth = computed(() => {
  const trackWidth = (scrollContainerWidth.value - 24 - (columnsPerRow.value - 1) * 12) / columnsPerRow.value
  return fixedColumnsPerRow.value ? trackWidth : Math.min(trackWidth, 450)
})

const CARD_COVER_HEIGHT = 208

/** height / width per interface `aspect_ratio`; `none` keeps the fixed band. */
const COVER_ASPECT: Record<string, number> = { wide: 9 / 16, square: 1, tall: 5 / 3 }

// Cover height is stamped inline so rendered height and slice math agree.
const coverHeight = computed(() => {
  const ratio = COVER_ASPECT[interfaceGalleryMeta.value?.cover_aspect_ratio ?? 'none']
  if (!ratio || cardWidth.value <= 0) return CARD_COVER_HEIGHT
  return Math.round(cardWidth.value * ratio)
})

/** Tile height / width: poster stays 4:5; minimal & simple follow the aspect ratio, 16:10 when none. */
const tileRatio = computed(() => {
  if (isPosterTheme.value) return 1.25
  return COVER_ASPECT[interfaceGalleryMeta.value?.cover_aspect_ratio ?? 'none'] ?? 0.625
})

const cardHeight = computed(() => {
  // TILE themes: width-driven. The height is stamped inline on the card, so
  // rendered height and slice math agree by construction — it just re-reacts
  // to container width. The 160px floor covers the unmeasured first paint
  // (container width 0).
  if (isTileTheme.value) {
    return Math.max(160, Math.round(cardWidth.value * tileRatio.value))
  }

  // Calculate cardHeight in pixels From the FIELD_HEIGHT_MAP and if the card has cover image
  // coverHeight px for Card Image Height (208 unless an interface aspect ratio applies)

  // 32 px for displayField
  // 16 px padding top and bottom
  // 12 px gap between each field
  // 2 px for border
  const displayFieldHeight = 32 + 16 + 16

  const fieldsHeight = fieldsWithoutDisplay.value.reduce((acc, field) => {
    const fieldHeight = FIELD_HEIGHT[field!.uidt!] || FIELD_HEIGHT.default
    return acc + fieldHeight + 12
  }, 0)

  return displayFieldHeight + fieldsHeight + (galleryData.value?.fk_cover_image_col_id ? coverHeight.value : 0) + 2
})

const visibleRows = computed(() => {
  const { start, end } = rowSlice
  return Array.from({ length: Math.min(end, totalRows.value) - start }, (_, i) => {
    const rowIndex = start + i
    return cachedRows.value.get(rowIndex) || { row: {}, oldRow: {}, rowMeta: { rowIndex, isLoading: true } }
  })
})

const {
  isRowColouringEnabled,
  getCellColorStyle: _getCellColorStyle,
  getCellLeftBorderStyle: _getCellLeftBorderStyle,
} = useViewRowColorRender()

function getCardColorStyle(record: RowType): Record<string, string> {
  const colorStyle = extractRowBackgroundColorStyle(record)

  if (galleryCardTheme.value === 'card') {
    return { ...colorStyle.rowBgColor, ...colorStyle.rowBorderColor }
  }

  // Poster keeps the neutral card surface — the raw record color is handed to
  // the host CSS (the coverless wash tile) via a custom property.
  const rawColor = record.rowMeta?.rowLeftBorderColor

  return rawColor ? { '--nc-record-color': rawColor } : {}
}

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

const updateVisibleRows = async () => {
  const { start, end } = rowSlice

  const firstChunkId = Math.floor(start / CHUNK_SIZE)
  const lastChunkId = Math.floor((end - 1) / CHUNK_SIZE)

  const chunksToFetch = new Set()

  for (let chunkId = firstChunkId; chunkId <= lastChunkId; chunkId++) {
    if (!chunkStates.value[chunkId]) chunksToFetch.add(chunkId)
  }

  const nextChunkId = lastChunkId + 1
  if (end % CHUNK_SIZE > CHUNK_SIZE - PREFETCH_THRESHOLD && !chunkStates.value[nextChunkId]) {
    chunksToFetch.add(nextChunkId)
  }

  const prevChunkId = firstChunkId - 1
  if (prevChunkId >= 0 && start % CHUNK_SIZE < PREFETCH_THRESHOLD && !chunkStates.value[prevChunkId]) {
    chunksToFetch.add(prevChunkId)
  }

  if (chunksToFetch.size > 0) {
    await Promise.all([...chunksToFetch].map((chunkId) => fetchChunk(chunkId)))
  }

  clearCache(Math.max(0, start - BUFFER_SIZE), Math.min(totalRows.value, end + BUFFER_SIZE))
}

const containerTransformY = ref(0)

const calculateSlices = () => {
  if (!scrollContainer.value) {
    setTimeout(calculateSlices, 50)
    return
  }

  const { clientHeight } = scrollContainer.value

  const visibleRowStart = Math.floor(scrollTop.value / (cardHeight.value + 12))

  const rowsVisible = Math.ceil((clientHeight - 12) / (cardHeight.value + 12))

  const BUFFER_ROWS = 2

  const startRecordIndex = Math.max(0, visibleRowStart - BUFFER_ROWS) * columnsPerRow.value
  const endRecordIndex = Math.min((visibleRowStart + rowsVisible + BUFFER_ROWS) * columnsPerRow.value, totalRows.value)

  rowSlice.start = startRecordIndex
  rowSlice.end = endRecordIndex

  const val = Math.ceil(rowSlice.start / columnsPerRow.value) * (cardHeight.value + 12)

  containerTransformY.value = val

  updateVisibleRows()
}

// Sizer for the virtual scroll. GRID_PADDING_Y covers the `p-3` gutter on
// `.nc-gallery-container`, which sits INSIDE this height: without it the
// scrollable extent falls 24px short of the rendered grid and the last row
// can't be scrolled fully into view. Only the tile themes showed it — they
// stamp an exact inline card height, while the card theme's `cardHeight` is a
// generous estimate whose surplus absorbed the gap.
const GRID_PADDING_Y = 24

const containerHeight = computed(() => {
  const numberOfRows = Math.ceil(totalRows.value / columnsPerRow.value)
  if (numberOfRows <= 0) return 0

  return numberOfRows * cardHeight.value + (numberOfRows - 1) * 12 + GRID_PADDING_Y
})

let scrollRaf = false

useScroll(scrollContainer, {
  onScroll: (e) => {
    if (scrollRaf) return
    scrollRaf = true
    requestAnimationFrame(() => {
      scrollTop.value = e.target?.scrollTop || 0
      calculateSlices()
      scrollRaf = false
    })
  },
  throttle: 200,
})

watch(
  view,
  async (nextView) => {
    isViewDataLoading.value = true
    try {
      if (nextView?.type === ViewTypes.GALLERY) {
        await syncCount()
        if (rowSlice.end === 0) {
          rowSlice.end = Math.min(100, totalRows.value)
        }
        await updateVisibleRows()
      }
    } finally {
      isViewDataLoading.value = false
    }
  },
  {
    immediate: true,
  },
)

const placeholderAboveHeight = computed(() => {
  const visibleRowStart = Math.floor(scrollTop.value / (cardHeight.value + 12))

  const startRecordIndex = Math.max(0, visibleRowStart - 2)
  const placeholderHeight = startRecordIndex * (cardHeight.value + 12)

  if (placeholderHeight > containerHeight.value) {
    return containerHeight.value - cardHeight.value
  }
  return placeholderHeight
})

const { width, height } = useWindowSize()

watch(
  [() => width.value, () => height.value, () => columnsPerRow.value, () => scrollContainerWidth.value, () => totalRows.value],
  () => {
    calculateSlices()
  },
  {
    immediate: true,
  },
)

// Theme flips resize the uniform card — recompute the slice window in place.
// Interface-only: the data-app's card height only moves with field edits,
// which already reload the view.
if (interfacePageDataApi) {
  watch(cardHeight, () => {
    calculateSlices()
  })
}

const reloadViewDataListener = withLoading(async () => {
  // Interface reloads (filter edits, user-filter picks) swap in place: keep
  // the current cards on screen and only re-arm the chunk states so the
  // visible range refetches over them — clearing the cache first blanks the
  // whole gallery for the fetch round-trip.
  if (interfacePageDataApi) {
    chunkStates.value = []
    await syncCount()
    calculateSlices()
    return
  }

  clearCache(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)
  await syncCount()
  calculateSlices()
})

reloadViewDataHook?.on(reloadViewDataListener)

const smartsheetEventHandler = (event: SmartsheetStoreEvents) => {
  if (event === SmartsheetStoreEvents.DATA_RELOAD) {
    reloadViewDataHook?.trigger()
  }
}

eventBus.on(smartsheetEventHandler)

onBeforeUnmount(() => {
  openNewRecordFormHook.off(openNewRecordFormHookHandler)
  eventBus.off(smartsheetEventHandler)
  reloadViewMetaHook?.off(reloadViewMetaListener)
  reloadViewDataHook?.off(reloadViewDataListener)
})

const handleOpenNewRecordForm = () => {
  if (showRecordPlanLimitExceededModal()) return

  openNewRecordFormHook.trigger()
}

const resetPointerEvent = (record: RowType, col: ColumnType) => {
  return isButton(col) || (isRowEmpty(record, col) && isAllowToRenderRowEmptyField(col))
}

// Skip blank fields entirely (label included) when the view meta opts in —
// leave field types that render something meaningful while empty (AI, button).
const hideEmptyCardFields = computed(() => !!parseProp(galleryData.value?.meta)?.hide_empty_card_fields)

const cardFields = (record: RowType) => {
  if (!hideEmptyCardFields.value) return fieldsWithoutDisplay.value

  return fieldsWithoutDisplay.value.filter((col) => !isRowEmpty(record, col) || isAllowToRenderRowEmptyField(col))
}

// Poster tiles with a cover attachment render the image + scrim overlay;
// coverless records fall back to the record-color wash with a centered title.
function hasPosterCover(record: RowType) {
  return isMounted.value && !reloadAttachments.value && attachments(record).length > 0
}
</script>

<template>
  <!-- Height: interface hosts (table page / dashboard widget / record-form LTAR)
       mount this in an `h-full` box under a `flex-1 min-h-0` parent, so fill the
       host the way SmartsheetGrid does. The viewport calc only holds for the
       standalone smartsheet view — the interface chrome differs per mode, so it
       mis-measured and pushed the last row out of scroll range. -->
  <div
    ref="scrollContainer"
    data-testid="nc-gallery-wrapper"
    class="flex flex-col w-full nc-gallery select-none relative nc-view-scrollbar-y bg-nc-bg-gray-extralight"
    :class="interfacePageDataApi ? 'h-full min-h-0' : 'h-[calc(100svh-var(--toolbar-height)-var(--topbar-height))]'"
    :style="fixedColumnsPerRow ? { '--nc-gallery-template-columns': `repeat(${fixedColumnsPerRow}, minmax(0, 1fr))` } : undefined"
  >
    <NcDropdown
      v-model:visible="contextMenu"
      :disabled="contextMenuTarget === null"
      :trigger="isSqlView ? [] : ['contextmenu']"
      overlay-class-name="nc-dropdown-grid-context-menu"
    >
      <template #overlay>
        <NcMenu
          :class="interfacePageDataApi ? '!rounded-lg nc-interface-card-context-menu' : ''"
          :variant="interfacePageDataApi ? 'medium' : 'small'"
          @click="contextMenu = false"
        >
          <NcMenuItem
            v-if="contextMenuTarget && canDuplicateRow"
            data-testid="nc-interface-gallery-menu-duplicate"
            @click="interfaceDuplicateRow"
          >
            <div v-e="['c:interface:gallery:record:duplicate']" class="flex items-center gap-2">
              <GeneralIcon icon="duplicate" class="flex" />
              {{ $t('labels.duplicateRecord') }}
            </div>
          </NcMenuItem>
          <NcMenuItem v-if="contextMenuTarget && interfaceClickIntoDetails" @click="expandForm(contextMenuTarget.row)">
            <div v-e="['a:row:expand-record']" class="flex items-center gap-2">
              <component :is="iconMap.maximize" class="flex" />
              {{ $t('activity.expandRecord') }}
            </div>
          </NcMenuItem>
          <!-- Send record is collaborator/data-app vocabulary — hidden on interface pages -->
          <NcMenuItem
            v-if="contextMenuTarget && contextMenuRowId && !isPublic && appInfo.ee && !interfacePageDataApi"
            @click="showSendRecordModal = true"
          >
            <div class="flex items-center gap-2">
              <GeneralIcon icon="mail" class="flex" />
              {{ $t('activity.sendRecord') }}
            </div>
          </NcMenuItem>
          <template v-if="interfacePageDataApi && contextMenuRowId">
            <NcDivider v-if="contextMenuTarget && (canDuplicateRow || interfaceClickIntoDetails)" />
            <NcMenuItem data-testid="nc-interface-gallery-menu-copy-url" @click="interfaceCopyRecordUrl">
              <div v-e="['c:interface:gallery:record:copy-url']" class="flex items-center gap-2">
                <GeneralIcon icon="ncLink" class="flex" />
                {{ $t('labels.copyRecordURL') }}
              </div>
            </NcMenuItem>
          </template>
          <NcDivider v-if="canAddDeleteRows" />
          <PermissionsTooltip
            v-if="contextMenuTarget?.index !== undefined && canAddDeleteRows"
            :entity="PermissionEntity.TABLE"
            :entity-id="meta?.id"
            :permission="PermissionKey.TABLE_RECORD_DELETE"
            placement="right"
          >
            <template #default="{ isAllowed }">
              <NcMenuItem
                danger
                data-testid="nc-gallery-context-menu-delete"
                :disabled="!isAllowed"
                @click="deleteRow(contextMenuTarget.index)"
              >
                <div v-e="['a:row:delete']" class="flex items-center gap-2">
                  <GeneralIcon icon="delete" />
                  {{ $t('activity.deleteRow') }}
                </div>
              </NcMenuItem>
            </template>
          </PermissionsTooltip>
        </NcMenu>
      </template>
      <div class="flex-1" @contextmenu.capture="resetContextMenuTarget">
        <div :key="containerHeight" class="relative" :style="{ height: `${containerHeight}px` }">
          <div :style="{ height: `${placeholderAboveHeight}px` }"></div>
          <div class="nc-gallery-container grid gap-3 p-3">
            <div
              v-for="record in visibleRows"
              :key="`record-${record.rowMeta.rowIndex}`"
              :data-card-id="`record-${record.rowMeta.rowIndex}`"
              :style="{
                filter:
                  showAsBluredRecord(isExternalSource, record.rowMeta.rowIndex + 1) && !record.rowMeta.new
                    ? 'blur(4px)'
                    : undefined,
                pointerEvents:
                  showAsBluredRecord(isExternalSource, record.rowMeta.rowIndex + 1) && !record.rowMeta.new ? 'none' : 'auto',
              }"
            >
              <LazySmartsheetRow :row="record">
                <a-card
                  class="relative !rounded-xl h-full !border-nc-border-gray-medium !bg-nc-bg-default border-1 group overflow-hidden break-all cursor-pointer flex flex-col"
                  :class="[
                    fixedColumnsPerRow ? '!max-w-none' : 'max-w-[450px]',
                    {
                      '!cursor-default': !interfaceShowRowExpand,
                      'nc-interface-card-selected': isCardSelected(record),
                    },
                  ]"
                  :body-style="{ padding: cardBodyPadding, flex: 1, display: 'flex' }"
                  :data-testid="`nc-gallery-card-${record.rowMeta.rowIndex}`"
                  :style="[getCardColorStyle(record), isTileTheme ? { height: `${cardHeight}px` } : {}]"
                  @click="expandFormClick($event, record)"
                  @contextmenu="showContextMenu($event, { row: record, index: record.rowMeta.rowIndex })"
                >
                  <SmartsheetRecordPresenceBadge v-if="isEeUI" :row="record" class="absolute top-2 right-2 z-10" />
                  <template v-if="showCover" #cover>
                    <a-carousel
                      v-if="isMounted && !reloadAttachments && attachments(record).length"
                      class="gallery-carousel !border-b-1 !border-nc-border-gray-medium !bg-nc-bg-default"
                      :style="{
                        'minHeight': `${coverHeight}px`,
                        '--nc-cover-h': `${coverHeight}px`,
                        ...extractRowBackgroundColorStyle(record).rowBgColor,
                        ...extractRowBackgroundColorStyle(record).rowBorderColor,
                      }"
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
                            class="!absolute !left-1.5 !bottom-0 !opacity-0 !group-hover:opacity-100 !rounded-lg cursor-pointer"
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
                            class="!absolute !right-1.5 !bottom-0 !opacity-0 !group-hover:opacity-100 !rounded-lg cursor-pointer"
                          >
                            <GeneralIcon icon="arrowRight" class="text-nc-content-inverted-secondary w-4 h-4" />
                          </NcButton>
                        </div>
                      </template>
                      <template
                        v-for="(attachment, index) in attachments(record)"
                        :key="`carousel-${record.rowMeta.rowIndex}-${index}`"
                      >
                        <!-- Slick clones its direct child and REPLACES its inline style, so the
                             cover height rides a CSS var set on the carousel root instead. -->
                        <LazyCellAttachmentPreviewThumbnail
                          :attachment="attachment"
                          class="nc-gallery-cover-thumb"
                          thumbnail="card_cover"
                          image-class="!w-full"
                          :object-fit="coverImageObjectFitStyle"
                          @click="expandFormClick($event, record)"
                        />
                      </template>
                    </a-carousel>
                    <div
                      v-else
                      class="w-full !flex flex-row !border-b-1 !border-nc-border-gray-medium items-center justify-center !bg-nc-bg-default"
                      :style="{ height: `${coverHeight}px` }"
                    >
                      <img class="object-contain w-[48px] h-[48px]" src="~assets/icons/FileIconImageBox.png" />
                    </div>
                  </template>

                  <!-- POSTER (interface-only): the image IS the card — title on a
                       bottom scrim; coverless records wash in the record color
                       with the title centered. Body fields never render. -->
                  <div
                    v-if="isTileTheme"
                    class="nc-gallery-poster-tile relative w-full h-full overflow-hidden"
                    :class="{
                      'nc-has-record-color': !!record.rowMeta?.rowLeftBorderColor,
                      'nc-gallery-tile-reveal': isSimpleTheme && hasPosterCover(record),
                    }"
                  >
                    <template v-if="hasPosterCover(record)">
                      <!-- Fill/Fit applies to the tile themes too: `contain`
                           letterboxes the image against the tile surface (gray,
                           or the record-colour wash). -->
                      <LazyCellAttachmentPreviewThumbnail
                        :attachment="attachments(record)[0]"
                        class="nc-gallery-poster-image !absolute !inset-0"
                        image-class="!w-full !h-full"
                        thumbnail="card_cover"
                        :object-fit="coverImageObjectFitStyle"
                      />
                      <div
                        v-if="!isMinimalTheme"
                        class="nc-gallery-poster-scrim absolute inset-x-0 bottom-0 h-2/5 pointer-events-none"
                      ></div>
                    </template>
                    <div v-else-if="isMinimalTheme" class="absolute inset-0 flex items-center justify-center">
                      <img class="object-contain w-[48px] h-[48px]" src="~assets/icons/FileIconImageBox.png" />
                    </div>

                    <!-- Caption: title (+ secondary field on simple). Overlaid on the scrim
                         with a cover; centered (poster) / top-and-bottom (simple) on the wash. -->
                    <div
                      v-if="displayField && !isMinimalTheme"
                      class="nc-gallery-tile-caption absolute z-1 p-3 flex flex-col gap-1.5"
                      :class="[
                        hasPosterCover(record) ? 'inset-x-0 bottom-0' : 'inset-0',
                        { 'justify-center': !hasPosterCover(record) && !secondaryField },
                        { 'justify-between': !hasPosterCover(record) && !!secondaryField },
                      ]"
                    >
                      <h2
                        class="nc-card-display-value-wrapper"
                        :class="[
                          hasPosterCover(record) ? 'nc-gallery-poster-title-overlay' : 'nc-gallery-poster-title-centered',
                          {
                            'nc-card-title-large': cardTitleSize === 'large',
                            'nc-card-title-interface': !!interfacePageDataApi,
                          },
                        ]"
                      >
                        <template
                          v-if="
                            !isRowEmpty(record, displayField) ||
                            isAllowToRenderRowEmptyField(displayField) ||
                            isPercent(displayField)
                          "
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
                        <template v-else> - </template>
                      </h2>

                      <div
                        v-if="secondaryField"
                        class="nc-gallery-tile-secondary !children:pointer-events-none"
                        :class="{ 'nc-gallery-tile-on-cover': hasPosterCover(record) }"
                      >
                        <LazySmartsheetVirtualCell
                          v-if="isVirtualCol(secondaryField)"
                          v-model="record.row[secondaryField.title]"
                          :column="secondaryField"
                          :row="record"
                        />
                        <LazySmartsheetCell
                          v-else
                          v-model="record.row[secondaryField.title]"
                          :column="secondaryField"
                          :edit-enabled="false"
                          :read-only="true"
                        />
                      </div>
                    </div>
                  </div>

                  <div v-else class="flex-1 flex content-stretch gap-3 w-full">
                    <div
                      v-if="isRowColouringEnabled"
                      class="w-1 flex-none min-h-4 rounded-sm"
                      :style="extractRowBackgroundColorStyle(record).rowLeftBorderColor"
                    ></div>
                    <div
                      class="flex-1 flex flex-col !children:pointer-events-none"
                      :class="{
                        'w-[calc(100%_-_16px)]': isRowColouringEnabled,
                        'w-full': !isRowColouringEnabled,
                        'gap-3': isActiveViewFieldHeaderVisible,
                      }"
                    >
                      <div
                        v-if="displayField"
                        class="flex gap-2 rounded-lg w-full z-1 relative"
                        :class="getCellColorClass(record, displayField.id)"
                        :style="getCellColorBgVar(record, displayField.id)"
                      >
                        <div
                          v-if="getCellLeftBorderStyle(record, displayField.id)"
                          class="w-1 flex-none min-h-4 rounded-sm"
                          :style="getCellLeftBorderStyle(record, displayField.id)"
                        ></div>
                        <h2
                          class="nc-card-display-value-wrapper flex-1 min-w-0 !children:pointer-events-auto"
                          :class="{
                            'nc-card-title-large': cardTitleSize === 'large',
                            'nc-card-title-interface': !!interfacePageDataApi,
                          }"
                        >
                          <template
                            v-if="
                              !isRowEmpty(record, displayField) ||
                              isAllowToRenderRowEmptyField(displayField) ||
                              isPercent(displayField)
                            "
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
                          <template v-else> - </template>
                        </h2>
                      </div>
                      <div
                        v-for="col in cardFields(record)"
                        :key="`record-${record.rowMeta.rowIndex}-${col.id}`"
                        class="nc-card-col-wrapper"
                        :class="{
                          '!children:pointer-events-auto': resetPointerEvent(record, col),
                        }"
                        @click="handleClick(col, $event)"
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
                              <div class="flex flex-row w-full justify-start">
                                <div
                                  v-if="isActiveViewFieldHeaderVisible"
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
                                v-if="!isRowEmpty(record, col) || isAllowToRenderRowEmptyField(col)"
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
              </LazySmartsheetRow>
            </div>

            <template v-if="visibleRows.length <= 4">
              <div v-for="index of Array(8 - visibleRows.length)" :key="index" class="nc-empty-card"></div>
            </template>
          </div>
        </div>
      </div>
    </NcDropdown>
    <!-- Floating new-record button — not shown in interfaces -->
    <div class="sticky bottom-4 w-[fit-content] z-10">
      <PermissionsTooltip
        v-if="isUIAllowed('dataInsert') && !isSyncedTable && canAddDeleteRows && !interfacePageDataApi"
        :entity="PermissionEntity.TABLE"
        :entity-id="meta?.id"
        :permission="PermissionKey.TABLE_RECORD_ADD"
      >
        <template #default="{ isAllowed }">
          <NcButton
            size="xs"
            type="secondary"
            class="ml-4 rtl:(mr-4 ml-0)"
            :disabled="!isAllowed"
            @click="handleOpenNewRecordForm"
          >
            <div class="flex items-center gap-2">
              <component :is="iconMap.plus" class="" />
              {{ $t('activity.newRecord') }}
            </div>
          </NcButton>
        </template>
      </PermissionsTooltip>
    </div>
  </div>
  <Suspense>
    <LazySmartsheetExpandedForm
      v-if="expandedFormRow && expandedFormDlg"
      v-model="expandedFormDlg"
      :row="expandedFormRow"
      :load-row="!isPublic"
      :first-row="isFirstRow"
      :last-row="isLastRow"
      :state="expandedFormRowState"
      :meta="meta"
      :view="view"
    />
  </Suspense>
  <Suspense>
    <LazySmartsheetExpandedForm
      v-if="expandedFormOnRowIdDlg && meta?.id"
      v-model="expandedFormOnRowIdDlg"
      :row="expandedFormRow ?? { row: {}, oldRow: {}, rowMeta: {} }"
      :meta="meta"
      :load-row="!isPublic"
      :row-id="route.query.rowId"
      :first-row="isFirstRow"
      :last-row="isLastRow"
      :view="view"
      show-next-prev-icons
      :expand-form="expandForm"
      @next="navigateToSiblingRow(NavigateDir.NEXT)"
      @prev="navigateToSiblingRow(NavigateDir.PREV)"
    />
  </Suspense>

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

.nc-gallery-container,
.nc-gallery-container-skeleton {
  @apply auto-rows-[1fr];
  // Interface `columns_per_row` pins the track list via the CSS var; the
  // auto-fit fallback must keep in sync with the `columnsPerRow` math.
  grid-template-columns: var(--nc-gallery-template-columns, repeat(auto-fit, minmax(250px, 1fr)));
}

.has-cell-bg-color {
  &::before {
    content: '';
    @apply absolute inset-0 -left-1 rounded-lg -z-1;
    background-color: var(--cell-bg-color);
  }
}

:deep(.slick-dots li button) {
  @apply !bg-black;
}

// Cover height from the carousel's `--nc-cover-h` (see the template note).
.ant-carousel.gallery-carousel :deep(.nc-gallery-cover-thumb) {
  height: var(--nc-cover-h);
}

// Simple tiles with a cover reveal scrim + caption on hover only.
// Gated on a real hover capability: on touch there is nothing to hover and a tap
// expands the record, so the caption would be permanently unreachable — those
// devices keep it visible instead of degrading `simple` into `minimal`.
@media (hover: hover) {
  .nc-gallery-tile-reveal {
    .nc-gallery-poster-scrim,
    .nc-gallery-tile-caption {
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    &:hover .nc-gallery-poster-scrim,
    &:focus-within .nc-gallery-poster-scrim,
    &:hover .nc-gallery-tile-caption,
    &:focus-within .nc-gallery-tile-caption {
      opacity: 1;
    }
  }
}

// Secondary field over the scrim reads white like the overlaid title.
.nc-gallery-tile-secondary.nc-gallery-tile-on-cover {
  &,
  :deep(.nc-cell),
  :deep(.nc-virtual-cell),
  :deep(.nc-cell .nc-cell-field:not(.ant-select-selection-search-input)),
  :deep(.nc-virtual-cell .nc-cell-field:not(.ant-select-selection-search-input)) {
    color: #fff !important;
  }
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
// Slick anchors its arrows at `top: 50%`; re-anchor to the cover's BOTTOM so the
// offset survives a variable cover height (interface `aspect_ratio`) instead of
// only lining up against the fixed 208px band.
.ant-carousel.gallery-carousel :deep(.slick-prev) {
  @apply left-0 top-auto bottom-3;
}

.ant-carousel.gallery-carousel :deep(.slick-next) {
  @apply right-0 top-auto bottom-3;
}

:deep(.ant-card) {
  @apply transition-all duration-0.3s;

  box-shadow: 0px 2px 4px -2px rgba(0, 0, 0, 0.06), 0px 4px 4px -2px rgba(0, 0, 0, 0.02);

  &:hover {
    @apply !border-nc-border-gray-dark;
    box-shadow: 0px 0px 24px 0px rgba(0, 0, 0, 0.1), 0px 0px 8px 0px rgba(0, 0, 0, 0.04);

    .nc-action-icon {
      @apply invisible;
    }
  }
}

.nc-card-display-value-wrapper {
  @apply my-0 text-subHeading2 text-nc-content-gray-subtle2;

  // Interface `title_size: large` — one typography step up (20px). The
  // `:not()` arm mirrors the base rule below: both are !important, and
  // without it the base's :not() variant ties on specificity and wins by
  // source order — the large size never rendered.
  &.nc-card-title-large {
    @apply text-subHeading1;

    :deep(.nc-cell),
    :deep(.nc-virtual-cell) {
      @apply text-subHeading1;

      .nc-cell-field,
      input,
      textarea,
      .nc-cell-field-link {
        @apply !text-subHeading1;

        &:not(.ant-select-selection-search-input) {
          @apply !text-subHeading1;
        }
      }
    }
  }

  // INTERFACE title scale — tighter than the data-app's subHeading steps:
  // 14px/20px default, 18px/26px large. Applied via a class the renderer
  // stamps only under an interface adapter, so the data-app keeps the
  // subHeading sizes above. Extra class depth out-ranks both base and
  // large rules deterministically.
  &.nc-card-title-interface {
    font-size: 14px !important;
    line-height: 20px !important;

    :deep(.nc-cell),
    :deep(.nc-virtual-cell) {
      .nc-cell-field,
      input,
      textarea,
      .nc-cell-field-link {
        &,
        &:not(.ant-select-selection-search-input) {
          font-size: 14px !important;
          line-height: 20px !important;
        }
      }
    }

    &.nc-card-title-large {
      font-size: 18px !important;
      line-height: 26px !important;

      :deep(.nc-cell),
      :deep(.nc-virtual-cell) {
        .nc-cell-field,
        input,
        textarea,
        .nc-cell-field-link {
          &,
          &:not(.ant-select-selection-search-input) {
            font-size: 18px !important;
            line-height: 26px !important;
          }
        }
      }
    }
  }

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

// Compound + :hover so the selection outlives the card's own hover styling
// (the gallery hover forces a gray border with !important).
.ant-card.nc-interface-card-selected,
.ant-card.nc-interface-card-selected:hover {
  border-color: var(--nc-border-brand) !important;
}
</style>

<!--
  Unscoped: the `nc-gallery-theme-*` class sits on the HOST (interface viz wrapper,
  dashboard widget host, record-form LTAR host), so a scoped rule can't reach it
  from here. Keyed on the theme classes alone rather than on each host, so every
  host that stamps one gets the tile styling — this lives with the markup it
  styles instead of being copied into each host.
-->
<style lang="scss">
// GALLERY — image tiles (poster / minimal / simple): the image IS the card.
// White title on the bottom scrim; coverless tiles wear a soft record-color
// wash (plain gray surface without a record color) with the title centered.
.nc-gallery-theme-poster,
.nc-gallery-theme-minimal,
.nc-gallery-theme-simple {
  .nc-gallery-poster-tile {
    background: var(--nc-bg-gray-light);

    &.nc-has-record-color {
      background: color-mix(in srgb, var(--nc-record-color, var(--nc-bg-default)) 14%, var(--nc-bg-default));
    }
  }

  .nc-gallery-poster-scrim {
    background: linear-gradient(to top, rgba(0, 0, 0, 0.65), transparent);
  }

  // Overlay title reads white over the scrim — out-ranks the renderer's
  // scoped/utility color stamps (brand on the cell root, gray on the field).
  h2.nc-gallery-poster-title-overlay {
    &,
    .nc-cell,
    .nc-virtual-cell,
    .nc-cell .nc-cell-field:not(.ant-select-selection-search-input),
    .nc-virtual-cell .nc-cell-field:not(.ant-select-selection-search-input),
    .nc-cell .nc-cell-field-link,
    .nc-cell input,
    .nc-cell textarea {
      color: #fff !important;
    }
  }

  // Wash tiles center the title — the inner cells are flex rows, so both
  // the text alignment and the flex axis need centering.
  h2.nc-gallery-poster-title-centered {
    .nc-cell,
    .nc-virtual-cell {
      justify-content: center;
    }

    .nc-cell-field {
      text-align: center;
    }
  }
}
</style>
