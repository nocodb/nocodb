<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import Draggable from 'vuedraggable'
import tinycolor from 'tinycolor2'
import { type ColumnType, PermissionEntity, PermissionKey, UITypes, isVirtualCol } from 'nocodb-sdk'
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

const { isMounted } = useIsMounted()

const {
  loadKanbanData,
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
  moveHistory,
  addNewStackId,
  removeRowFromUncategorizedStack,
  uncategorizedStackId,
  updateStackProperty,
  updateAllStacksProperty,
} = useKanbanViewStoreOrThrow()

const { isViewDataLoading, isActiveViewFieldHeaderVisible } = storeToRefs(useViewsStore())

const { isUIAllowed } = useRoles()

const { appInfo, isMobileMode } = useGlobal()

const { addUndo, defineViewScope } = useUndoRedo()

const { showRecordPlanLimitExceededModal } = useEeConfig()

const { withLoading } = useLoadingTrigger()

provide(IsFormInj, ref(false))

provide(IsGalleryInj, ref(false))

provide(IsGridInj, ref(false))

provide(IsKanbanInj, ref(true))

const hasEditPermission = computed(
  () => isUIAllowed('dataEdit') && (!isSyncedTable.value || !groupingFieldColumn.value?.readonly),
)

const fields = inject(FieldsInj, ref([]))

const fieldsWithoutDisplay = computed(() => fields.value.filter((f) => !isPrimary(f)))

const displayField = computed(() => meta.value?.columns?.find((c) => c.pv && fields.value.includes(c)) ?? null)

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

const { isRowColouringEnabled } = useViewRowColorRender()

const kanbanContainerRef = ref()

const selectedStackTitle = ref('')

// Horizontal virtual scrolling for stacks
const STACK_WIDTH = 274 // w-68.5 = 274px (17.125rem * 16)
const STACK_GAP = 12 // gap-3 = 12px
const STACK_WIDTH_WITH_GAP = STACK_WIDTH + STACK_GAP

const horizontalScrollLeft = ref(0)
const horizontalContainerWidth = ref(0)

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

// Check if a stack is visible horizontally
const isStackVisible = (index: number): boolean => {
  if (!stackSlice.end) {
    // If slice not calculated, show initial stacks
    return index < 5
  }
  // Add small buffer for edge cases
  const EXTRA_BUFFER = 1
  return index >= Math.max(0, stackSlice.start - EXTRA_BUFFER) && index < stackSlice.end + EXTRA_BUFFER
}

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
  await loadKanbanData()
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

const expandForm = (row: RowType, state?: Record<string, any>) => {
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

const contextMenu = computed({
  get: () => _contextMenu.value,
  set: (val) => {
    if (hasEditPermission.value) {
      _contextMenu.value = val
    }
  },
})

const contextMenuTarget = ref<RowType | null>(null)

const showContextMenu = (e: MouseEvent, target?: RowType) => {
  e.preventDefault()
  if (target) {
    contextMenuTarget.value = target
  }
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
  if (event.draggedContext.futureIndex === 0) {
    return false
  }
}

async function onMoveStack(event: any, undo = false) {
  if (event.moved) {
    const { oldIndex, newIndex } = event.moved

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

    if (!undo) {
      addUndo({
        undo: {
          fn: async (e: any) => {
            const undoStackMeta = [...groupingFieldColOptions.value]
            undoStackMeta[e.moved.newIndex] = { ...undoStackMeta[e.moved.newIndex], order: e.moved.oldIndex }
            undoStackMeta[e.moved.oldIndex] = { ...undoStackMeta[e.moved.oldIndex], order: e.moved.newIndex }

            const undoStackMetaObj = {
              ...stackMetaObj.value,
              [kanbanMetaData.value.fk_grp_col_id!]: undoStackMeta,
            }

            await updateKanbanMeta({ meta: undoStackMetaObj })
          },
          args: [{ moved: { oldIndex, newIndex } }],
        },
        redo: {
          fn: async (e: any) => {
            const redoStackMeta = [...groupingFieldColOptions.value]
            redoStackMeta[e.moved.oldIndex] = { ...redoStackMeta[e.moved.oldIndex], order: e.moved.newIndex }
            redoStackMeta[e.moved.newIndex] = { ...redoStackMeta[e.moved.newIndex], order: e.moved.oldIndex }

            const redoStackMetaObj = {
              ...stackMetaObj.value,
              [kanbanMetaData.value.fk_grp_col_id!]: redoStackMeta,
            }

            await updateKanbanMeta({ meta: redoStackMetaObj })
          },
          args: [{ moved: { oldIndex, newIndex } }],
        },
        scope: defineViewScope({ view: view.value }),
      })
    }
  }
}

async function onMove(event: any, stackKey: string) {
  if (event.added) {
    const ele = event.added.element

    moveHistory.value.unshift({
      op: 'added',
      pk: extractPkFromRow(event.added.element.row, meta.value!.columns!),
      index: event.added.newIndex,
      stack: stackKey,
    })

    ele.row[groupingField.value] = stackKey
    countByStack.value.set(stackKey, countByStack.value.get(stackKey)! + 1)
    await updateOrSaveRow(ele)
  } else if (event.removed) {
    countByStack.value.set(stackKey, countByStack.value.get(stackKey)! - 1)
    moveHistory.value.unshift({
      op: 'removed',
      pk: extractPkFromRow(event.removed.element.row, meta.value!.columns!),
      index: event.removed.oldIndex,
      stack: stackKey,
    })
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
    await loadKanbanData()

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
      class="nc-kanban-container flex p-3 overflow-y-hidden w-full nc-scrollbar-x-lg min-h-[calc(100%_-_0.4rem)] max-h-[calc(100%_-_0.4rem)]"
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
        <div class="flex gap-3">
          <!-- Draggable Stack -->
          <Draggable
            v-model="groupingFieldColOptions"
            v-bind="getDraggableAutoScrollOptions({ scrollSensitivity: 100 })"
            class="flex gap-3"
            item-key="id"
            group="kanban-stack"
            draggable=".nc-kanban-stack"
            handle=".nc-kanban-stack-drag-handler"
            :filter="draggableStackFilter"
            :move="onMoveCallback"
            @start="(e) => e.target.classList.add('grabbing')"
            @end="(e) => e.target.classList.remove('grabbing')"
            @change="onMoveStack($event)"
          >
            <template #item="{ element: stack, index: stackIdx }">
              <div
                v-if="isStackVisible(stackIdx)"
                class="nc-kanban-stack"
                :class="{
                  'w-[44px]': stack.collapsed,
                  'hidden':
                    (hideEmptyStack && !formattedData.get(stack.title)?.length) ||
                    (isRequiredGroupingFieldColumn && stack.id === uncategorizedStackId),
                }"
                :data-testid="`nc-kanban-stack-${stack.title}`"
              >
                <!-- Non Collapsed Stacks -->
                <a-card
                  v-if="!stack.collapsed"
                  :key="`${stack.id}-${stackIdx}`"
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
                  <!-- Skeleton -->
                  <div v-if="!formattedData.get(stack.title) || !countByStack" class="mt-2.5 px-3 !w-full">
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
                            v-if="!(isLocked || isPublic || !hasEditPermission)"
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
                                @submit="(loadMeta, payload) => handleSubmitRenameOrNewStack(loadMeta, payload, stackIdx)"
                              />
                            </template>
                            <a-tag
                              v-else
                              class="max-w-full !rounded-full !px-2 !py-1 h-7 !m-0 !border-none !mt-0.5"
                              :color="getSelectTypeFieldOptionBgColor({ color: stack.color || '#ccc', isDark })"
                              @dblclick="
                                () => {
                                  if (stack.title !== null && hasEditPermission && !isPublic && !isLocked) {
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
                                  }),
                                }"
                                class="text-sm font-semibold"
                              >
                                <NcTooltip class="truncate max-w-full" placement="bottom" show-on-truncate-only>
                                  <template #title>
                                    {{ stack.title ?? 'Uncategorized' }}
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
                                    {{ stack.title ?? 'Uncategorized' }}
                                  </span>
                                </NcTooltip>
                              </span>
                            </a-tag>
                          </div>
                        </div>
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
                            data-testid="nc-kanban-stack-context-menu"
                          >
                            <GeneralIcon icon="threeDotVertical" />
                          </NcButton>

                          <template #overlay>
                            <NcMenu variant="small">
                              <PermissionsTooltip
                                v-if="hasEditPermission && !isPublic && !isSyncedTable"
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
                                v-if="stack.title !== null && hasEditPermission && !isPublic && !isLocked"
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
                                v-e="['c:kanban:collapse-stack']"
                                data-testid="nc-kanban-context-menu-collapse-stack"
                                @click="handleCollapseStack(stackIdx)"
                              >
                                <div class="flex gap-2 items-center">
                                  <component :is="iconMap.minimize" class="flex-none w-4 h-4" />
                                  {{ $t('activity.kanban.collapseStack') }}
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
                              <template v-if="stack.title !== null && !isPublic && hasEditPermission && !isLocked">
                                <NcDivider />
                                <NcMenuItem
                                  v-e="['c:kanban:delete-stack']"
                                  danger
                                  data-testid="nc-kanban-context-menu-delete-stack"
                                  @click="handleDeleteStackClick(stack.title, stackIdx)"
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
                        <!-- Draggable Record Card - full list for drag functionality, but only render visible items -->
                        <Draggable
                          v-if="formattedData.get(stack.title)"
                          v-bind="getDraggableAutoScrollOptions({ scrollSensitivity: 150 })"
                          :list="formattedData.get(stack.title) || []"
                          item-key="row.id"
                          draggable=".nc-kanban-item"
                          group="kanban-card"
                          class="flex flex-col"
                          :style="{
                            minHeight: formattedData.get(stack.title)?.length ? `${getTotalScrollHeight(stack.title)}px` : '100%',
                            height: formattedData.get(stack.title)?.length ? 'auto' : '100%',
                          }"
                          :disabled="isMobileMode"
                          :filter="draggableCardFilter"
                          :force-fallback="false"
                          :fallback-tolerance="0"
                          @start="(e) => e.target.classList.add('grabbing')"
                          @end="(e) => e.target.classList.remove('grabbing')"
                          @change="onMove($event, stack.title)"
                        >
                          <template #item="{ element: record, index }">
                            <div class="nc-kanban-item py-1 first:pt-2 last:pb-2">
                              <SmartsheetRow v-if="isCardVisible(stack.title, index)" :row="record">
                                <a-card
                                  :key="`${getRowId(record)}-${index}`"
                                  class="!rounded-lg h-full border-nc-border-gray-medium border-1 group overflow-hidden break-all max-w-[450px] cursor-pointer flex flex-col"
                                  :body-style="{
                                    padding: '12px !important',
                                    flex: 1,
                                    display: 'flex',
                                  }"
                                  :data-stack="stack.title"
                                  :data-testid="`nc-gallery-card-${record.row.id}`"
                                  :class="{
                                    'not-draggable': !hasEditPermission || isPublic,
                                    '!cursor-default': !hasEditPermission || isPublic,
                                  }"
                                  :style="{
                                    ...extractRowBackgroundColorStyle(record).rowBgColor,
                                    ...extractRowBackgroundColorStyle(record).rowBorderColor,
                                  }"
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
                                      <h2
                                        v-if="displayField"
                                        class="nc-card-display-value-wrapper"
                                        :class="{
                                          '!children:pointer-events-auto': resetPointerEvent(record, displayField),
                                        }"
                                      >
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

                                          <LazySmartsheetCell
                                            v-else
                                            v-model="record.row[displayField.title]"
                                            class="!text-nc-content-brand"
                                            :column="displayField"
                                            :edit-enabled="false"
                                            :read-only="true"
                                          />
                                        </template>
                                        <template v-else> -</template>
                                      </h2>

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
                                            class="flex flex-col rounded-lg w-full"
                                            :class="{
                                              'pointer-events-none': !resetPointerEvent(record, col),
                                            }"
                                          >
                                            <div v-if="isActiveViewFieldHeaderVisible" class="flex flex-row w-full justify-start">
                                              <div class="nc-card-col-header w-full !children:text-nc-content-gray-muted">
                                                <LazySmartsheetHeaderVirtualCell
                                                  v-if="isVirtualCol(col)"
                                                  :column="col"
                                                  :hide-menu="true"
                                                />

                                                <LazySmartsheetHeaderCell v-else :column="col" :hide-menu="true" />
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

                        <!-- Empty state -->
                        <div
                          v-if="!formattedData.get(stack.title)?.length"
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
                            v-if="isUIAllowed('dataInsert') && !isSyncedTable"
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
                    <a-layout-footer v-if="formattedData.get(stack.title)" class="border-t-1 border-nc-border-gray-light">
                      <div class="flex items-center justify-between">
                        <PermissionsTooltip
                          v-if="isUIAllowed('dataInsert') && !isSyncedTable"
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

                        <!-- Record Count -->
                        <div class="nc-kanban-data-count text-nc-content-gray-muted font-weight-500 px-1">
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
                  class="nc-kanban-collapsed-stack flex items-center w-68.5 h-[44px] !rounded-xl cursor-pointer h-full !p-2 overflow-hidden !shadow-none !hover:shadow-none !border-nc-border-gray-medium"
                  :class="{
                    'not-draggable': stack.title === null || isLocked || isPublic || !hasEditPermission,
                  }"
                  :body-style="{
                    padding: '0px !important',
                    height: '100%',
                    width: '100%',
                    borderRadius: '0.75rem !important',
                    paddingBottom: '0rem !important',
                  }"
                >
                  <div class="h-full flex items-center justify-between" @click="handleCollapseStack(stackIdx)">
                    <div
                      v-if="!formattedData.get(stack.title) || !countByStack"
                      class="!w-full !h-full flex items-center justify-center"
                    >
                      <a-skeleton-input :active="true" class="!w-full !h-4 !rounded-lg overflow-hidden" />
                    </div>
                    <div v-else class="nc-kanban-stack-head w-full flex items-center justify-between gap-2">
                      <div class="flex items-center gap-1">
                        <NcButton
                          v-if="!(isLocked || isPublic || !hasEditPermission)"
                          :disabled="!stack.title"
                          type="text"
                          size="xs"
                          class="nc-kanban-stack-drag-handler !px-1.5 !cursor-move"
                          @click.stop
                        >
                          <GeneralIcon icon="ncDrag" class="font-weight-800 flex-none" />
                        </NcButton>

                        <div class="flex-1 flex max-w-[115px]">
                          <a-tag
                            class="max-w-full !rounded-full !px-2 !py-1 h-7 !m-0 !border-none"
                            :color="getSelectTypeFieldOptionBgColor({ color: stack.color || '#ccc', isDark })"
                          >
                            <span
                              :style="{
                                color: getSelectTypeFieldOptionTextColor({
                                  color: stack.color || '#ccc',
                                  isDark,
                                  getColor,
                                }),
                              }"
                              class="text-sm font-semibold"
                            >
                              <NcTooltip class="truncate max-w-full" placement="left" show-on-truncate-only>
                                <template #title>
                                  {{ stack.title ?? 'Uncategorized' }}
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
                                  {{ stack.title ?? 'Uncategorized' }}
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
                          <!-- Record Count -->
                          {{ formattedData.get(stack.title)!.length }}
                          {{ countByStack.get(stack.title) !== 1 ? $t('objects.records') : $t('objects.record') }}
                        </div>

                        <NcButton type="text" size="xs" class="!px-1.5">
                          <component :is="iconMap.arrowDown" class="h-4 w-4 flex-none opacity-75" />
                        </NcButton>
                      </div>
                    </div>
                  </div>
                </a-card>
              </div>

              <!-- Placeholder for non-visible stacks - maintains layout but doesn't render content -->
              <div
                v-else
                class="nc-kanban-stack"
                :style="{
                  width: stack.collapsed ? '44px' : `${STACK_WIDTH}px`,
                  flexShrink: 0,
                  height: '100%',
                  minWidth: stack.collapsed ? '44px' : `${STACK_WIDTH}px`,
                  maxWidth: stack.collapsed ? '44px' : `${STACK_WIDTH}px`,
                }"
              />
            </template>
          </Draggable>

          <div v-if="hasEditPermission && !isPublic && !isLocked && groupingFieldColumn?.id" class="nc-kanban-add-new-stack">
            <!-- Add New Stack -->
            <a-card
              class="flex flex-col w-68.5 !rounded-xl overflow-y-hidden !shadow-none !hover:shadow-none border-nc-border-gray-medium nc-kanban-stack-header-new-stack"
              :class="[
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
                    <NcButton
                      v-if="!compareStack(addNewStackObj, isRenameOrNewStack)"
                      type="secondary"
                      class="add-new-stack-btn w-full !rounded-xl min-h-11"
                    >
                      <div class="flex items-center gap-2">
                        <component :is="iconMap.plus" v-if="!isPublic && !isLocked" class="" />

                        {{ $t('general.new') }} {{ $t('general.stack').toLowerCase() }}
                      </div>
                    </NcButton>

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
        <template v-if="!isLocked && !isPublic && hasEditPermission" #overlay>
          <NcMenu variant="small" @click="contextMenu = false">
            <NcMenuItem v-if="contextMenuTarget" v-e="['a:kanban:expand-record']" @click="expandForm(contextMenuTarget)">
              <div class="flex items-center gap-2 nc-kanban-context-menu-item">
                <component :is="iconMap.maximize" class="flex" />
                <!-- Expand Record -->
                {{ $t('activity.expandRecord') }}
              </div>
            </NcMenuItem>
            <NcDivider />
            <PermissionsTooltip
              v-if="contextMenuTarget"
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
    entity-name="Stack"
    :show-default-delete-msg="false"
    :on-delete="handleDeleteStackConfirmClick"
  >
    <template #entity-preview>
      <div v-if="stackToBeDeleted" class="text-nc-content-gray flex flex-col gap-3">
        <div>
          This action will also remove the <b>"{{ stackToBeDeleted }}"</b> option from the
          <b> "{{ groupingFieldColumn?.title ?? 'Grouping' }}"</b> field.
        </div>
        <div>Records will be moved to Uncategorized stack.</div>
      </div>
    </template>
  </GeneralDeleteModal>
</template>

<style lang="scss" scoped>
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
  @apply my-0 text-xl leading-8 text-nc-content-gray-subtle2;

  .nc-cell,
  .nc-virtual-cell {
    @apply text-xl leading-8;

    :deep(.nc-cell-field),
    :deep(input),
    :deep(textarea),
    :deep(.nc-cell-field-link) {
      @apply !text-xl leading-8 text-nc-content-gray-subtle2;

      &:not(.ant-select-selection-search-input) {
        @apply !text-xl leading-8 text-nc-content-gray-subtle2;
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
</style>
