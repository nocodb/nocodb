import type { GridType, ViewType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import { parseCellWidth } from '../utils/cell'
import { AGGREGATION_HEIGHT, FROZEN_AREA_MAX_WIDTH_RATIO } from '../utils/constants'

const HIT_ZONE_HALF_WIDTH = 5

/**
 * Draggable freeze divider — the vertical boundary between frozen and
 * scrollable fields. Dragging snaps to field edges (1..MAX_FROZEN_FIELDS)
 * and persists `frozen_column_count` in the grid view meta.
 */
export function useFreezeDivider({
  columns,
  width,
  height,
  headerRowHeight,
  mousePosition,
  savedFrozenCount,
  effectiveFrozenCount,
  frozenCountOverride,
  view,
  isMobileMode,
  isViewOperationsAllowed,
  triggerRefreshCanvas,
}: {
  columns: ComputedRef<CanvasGridColumn[]>
  width: Ref<number>
  height: Ref<number>
  headerRowHeight: ComputedRef<number>
  mousePosition: { x: number; y: number }
  savedFrozenCount: ComputedRef<number>
  effectiveFrozenCount: ComputedRef<number>
  frozenCountOverride: Ref<number | null>
  view: Ref<ViewType | undefined>
  isMobileMode: Ref<boolean>
  isViewOperationsAllowed: ComputedRef<boolean>
  triggerRefreshCanvas: () => void
}) {
  const { t } = useI18n()

  const { updateViewMeta } = useViewsStore()

  const { showInfoModal } = useNcConfirmModal()

  const isLocked = inject(IsLockedInj, ref(false))

  const isPublicView = inject(IsPublicInj, ref(false))

  // Interface grids persist through the adapter (viz config) — builder only
  const interfacePageDataApi = inject(InterfacePageDataInj, undefined)

  const { isSharedBase } = storeToRefs(useBase())

  const freezeDrag = ref<{ previewCount: number; previewX: number } | null>(null)

  const canAdjustFrozen = computed(() => {
    if (isMobileMode.value) return false

    // Interface mounts are always "public" — gate on builder edit mode instead
    if (interfacePageDataApi) {
      return !!interfacePageDataApi.canConfigureFields?.value && !!interfacePageDataApi.setFrozenFieldCount
    }

    return !isLocked.value && !isPublicView.value && !isSharedBase.value && isViewOperationsAllowed.value
  })

  // x of the freeze boundary in canvas coords (right edge of the last fixed column)
  const freezeDividerX = computed(() =>
    columns.value.reduce((sum, col) => (col.fixed ? sum + parseCellWidth(col.width) : sum), 0),
  )

  // Snap targets: {count, x} for each allowed frozen field count. Counts whose
  // cumulative field width exceeds the viewport ratio are not offered (count 1
  // always is — the display value cannot be unfrozen).
  const freezeSnapPoints = computed<{ count: number; x: number }[]>(() => {
    const rowNumberCol = columns.value.find((col) => col.id === 'row_number')
    const fieldCols = columns.value.filter((col) => col.id !== 'row_number')
    const maxFrozenWidth = width.value * FROZEN_AREA_MAX_WIDTH_RATIO

    const points: { count: number; x: number }[] = []
    let fieldWidthSum = 0

    for (let count = 1; count <= Math.min(MAX_FROZEN_FIELDS, fieldCols.length); count++) {
      fieldWidthSum += parseCellWidth(fieldCols[count - 1]?.width)
      if (count > 1 && fieldWidthSum > maxFrozenWidth) break
      points.push({ count, x: parseCellWidth(rowNumberCol?.width) + fieldWidthSum })
    }
    return points
  })

  const fieldColumnCount = computed(() => columns.value.filter((col) => col.id !== 'row_number').length)

  // Saved count can't be honored at this viewport width
  const isFrozenCountClamped = computed(
    () => effectiveFrozenCount.value < Math.min(savedFrozenCount.value, fieldColumnCount.value),
  )

  // A clamped count offers a reset — unless the saved count is already 1, which
  // leaves the divider with nothing to drag and nothing to reset.
  const isFreezeDividerActionable = computed(() => !isFrozenCountClamped.value || savedFrozenCount.value > 1)

  function isInFreezeDividerZone(x: number, y: number) {
    return (
      canAdjustFrozen.value &&
      isFreezeDividerActionable.value &&
      Math.abs(x - freezeDividerX.value) <= HIT_ZONE_HALF_WIDTH &&
      y > headerRowHeight.value &&
      y < height.value - AGGREGATION_HEIGHT
    )
  }

  const isFreezeDividerHovered = computed(() => !!freezeDrag.value || isInFreezeDividerZone(mousePosition.x, mousePosition.y))

  async function persistFrozenCount(count: number) {
    // Interface grid: the host writes viz `frozen_column_count` into the local
    // config synchronously, so the adapter's reactive count is already current —
    // no optimistic override to bridge (one that the host silently dropping the
    // write, e.g. edit mode ended mid-drag, would leave stuck).
    if (interfacePageDataApi) {
      interfacePageDataApi.setFrozenFieldCount?.(count)
      return
    }

    if (!view.value?.id) return

    const previous = frozenCountOverride.value

    frozenCountOverride.value = count

    try {
      const currentMeta = parseProp((view.value?.view as GridType)?.meta)

      await updateViewMeta(view.value.id, ViewTypes.GRID, { meta: { ...currentMeta, frozen_column_count: count } })

      // Fall back to whatever the view now reports — if the write didn't take,
      // the grid should show that instead of holding the optimistic count.
      frozenCountOverride.value = null
    } catch (e) {
      frozenCountOverride.value = previous
      message.error(t('msg.error.errorWhileUpdatingView'))
    }
  }

  function showTooNarrowModal() {
    showInfoModal({
      title: t('title.tooNarrowToAdjustFrozenFields'),
      content: t('msg.info.tooNarrowToAdjustFrozenFields', {
        saved: savedFrozenCount.value,
        effective: effectiveFrozenCount.value,
      }),
      okText: t('labels.resetToOneFrozenField'),
      showCancelBtn: true,
      okCallback: async () => {
        await persistFrozenCount(1)
      },
    })
  }

  function snapCountFromX(x: number) {
    const points = freezeSnapPoints.value
    if (!points.length) return null

    let nearest = points[0]!
    for (const point of points) {
      if (Math.abs(x - point.x) < Math.abs(x - nearest.x)) nearest = point
    }
    return nearest
  }

  let onDragMove: ((e: MouseEvent) => void) | null = null

  let onDragUp: (() => void) | null = null

  function detachDragListeners() {
    if (onDragMove) document.removeEventListener('mousemove', onDragMove)
    if (onDragUp) document.removeEventListener('mouseup', onDragUp)
    onDragMove = null
    onDragUp = null
  }

  /** Returns true when the mousedown was consumed by the divider. */
  function handleFreezeDividerMouseDown(e: MouseEvent, rect: DOMRect) {
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (!isInFreezeDividerZone(x, y)) return false

    // Offer a reset instead of a drag that would snap right back (the zone check
    // above already excluded the clamped-with-nothing-to-reset case).
    if (isFrozenCountClamped.value) {
      e.preventDefault()
      showTooNarrowModal()
      return true
    }

    const currentSnap = snapCountFromX(freezeDividerX.value)
    if (!currentSnap) return false

    e.preventDefault()

    freezeDrag.value = { previewCount: currentSnap.count, previewX: currentSnap.x }
    triggerRefreshCanvas()

    onDragMove = (moveEvent: MouseEvent) => {
      const snap = snapCountFromX(moveEvent.clientX - rect.left)
      if (!snap || snap.count === freezeDrag.value?.previewCount) return
      freezeDrag.value = { previewCount: snap.count, previewX: snap.x }
      triggerRefreshCanvas()
    }

    onDragUp = () => {
      detachDragListeners()

      const previewCount = freezeDrag.value?.previewCount
      freezeDrag.value = null
      triggerRefreshCanvas()

      if (previewCount && previewCount !== savedFrozenCount.value) {
        persistFrozenCount(previewCount)
      }
    }

    document.addEventListener('mousemove', onDragMove)
    document.addEventListener('mouseup', onDragUp)

    return true
  }

  // Unmounting mid-drag (view switch, realtime view delete) must not leave the
  // listeners writing `frozen_column_count` to a view we already navigated off.
  onBeforeUnmount(() => {
    detachDragListeners()
    freezeDrag.value = null
  })

  return {
    freezeDrag,
    canAdjustFrozen,
    freezeDividerX,
    isFreezeDividerHovered,
    isInFreezeDividerZone,
    handleFreezeDividerMouseDown,
  }
}
