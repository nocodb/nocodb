<script lang="ts" setup>
/**
 * Cross-group dependency arrow overlay for Gantt grouped mode.
 *
 * Per-group Grid components handle in-group arrows on their own SVG.
 * Cross-group arrows — where predecessor and successor sit in different
 * groups — can't be drawn from any single Grid (each Grid only knows its
 * own records). This overlay sits at the DateAxisGroupBy scroll-container
 * level and renders ONLY edges whose endpoints span groups.
 *
 * Round 1 scope:
 *   - Single-level grouping only (no nested groups)
 *   - Expanded groups only (collapse-aware routing deferred to round 2)
 *   - Reuses the existing per-edge buildArrowPath geometry — just feeds it
 *     globally-measured y coordinates.
 *
 * Positioning: DOM-measured. Each per-group Grid carries a
 * data-gantt-record-id attribute on each row; we measure those rects
 * relative to the parent scroll container to get global y. Recomputed via
 * ResizeObserver whenever the layout shifts.
 */
import type { ColumnType } from 'nocodb-sdk'
import dayjs from 'dayjs'
import type { Row as RowType } from '#imports'
import { TIMELINE_GROUP_SIDEBAR_WIDTH } from '~/utils/timelineUtils'

interface Props {
  // Scroll area element from DateAxisGroupBy — origin for relative positions.
  scrollAreaEl: HTMLElement | null
  // Expanded-groups state. Round 1 limits drawing to fully-expanded layouts.
  expandedGroups: Record<string, boolean>
}

const props = defineProps<Props>()

const meta = inject(MetaInj, ref())

const { ganttRange, dependencyLinks, invalidReasonFor, colWidth, scrollLeft, inspectorRecord } = useGanttViewStoreOrThrow()

const { rootGroup } = useViewGroupByOrThrow()

const pkCols = computed(() => (meta.value?.columns ?? []) as ColumnType[])

// Resolve range columns / dep col once so the path builder doesn't keep
// reaching into ganttRange[0] on every edge.
const range = computed(() => ganttRange.value?.[0])

// Geometry helpers — duplicated (intentionally) from Grid.vue so the
// overlay can compute bar/milestone X without coupling to the per-group
// Grid instances. Y still comes from DOM measurement; X is data-driven.

const parseDate = (row: RowType, col: ColumnType | undefined | null): dayjs.Dayjs | null => {
  if (!col?.title) return null
  const val = row.row?.[col.title]
  if (!val) return null
  const d = dayjs(val)
  return d.isValid() ? d : null
}

interface RecordGeometry {
  leftX: number
  rightX: number
  isMilestone: boolean
}

const { visibleDates } = useGanttViewStoreOrThrow()

// Must match Grid.vue's MILESTONE_SIZE (ROW_HEIGHT - 8).
const ROW_HEIGHT = 36
const MILESTONE_SIZE = ROW_HEIGHT - 8

const recordGeometry = (row: RowType): RecordGeometry | null => {
  const r = range.value
  if (!r) return null
  const firstVisibleDate = visibleDates.value?.[0]
  if (!firstVisibleDate) return null
  const cw = colWidth.value

  const start = parseDate(row, r.fk_from_col)
  const end = r.fk_to_col ? parseDate(row, r.fk_to_col) : start

  // Milestone: only end date present, no start. Diamond centered on the
  // end-date column. Match Grid.vue's getMilestoneStyle layout.
  if (!start && end && r.fk_to_col) {
    const offset = end.diff(firstVisibleDate, 'day')
    const centerX = offset * cw + cw / 2
    return {
      leftX: centerX - MILESTONE_SIZE / 2,
      rightX: centerX + MILESTONE_SIZE / 2,
      isMilestone: true,
    }
  }

  if (!start) return null
  const effectiveEnd = end || start
  const startOffset = start.diff(firstVisibleDate, 'day')
  const duration = effectiveEnd.diff(start, 'day') + 1
  const leftX = startOffset * cw
  // Match Grid.vue's bar width math: max(duration * cw - 4, 20)
  const rightX = leftX + Math.max(duration * cw - 4, 20)
  return { leftX, rightX, isMilestone: false }
}

// --- DOM-measured y positions + record-to-group lookup ---
// recordY: record_id → global y center in the scroll-area's content space.
// recordToGroup: record_id → stable group index (position among
// [data-gantt-group-grid] elements in DOM order).

const recordY = ref<Map<string, number>>(new Map())
const recordToGroup = ref<Map<string, number>>(new Map())

const remeasure = () => {
  const el = props.scrollAreaEl
  if (!el) {
    recordY.value = new Map()
    recordToGroup.value = new Map()
    return
  }
  const containerRect = el.getBoundingClientRect()
  const scrollTop = el.scrollTop

  // Index all per-group Grid wrappers so we can resolve each row's group.
  const gridEls = Array.from(el.querySelectorAll<HTMLElement>('[data-gantt-group-grid]'))
  const gridIndex = new Map<HTMLElement, number>()
  gridEls.forEach((g, idx) => gridIndex.set(g, idx))

  const nextY = new Map<string, number>()
  const nextGroup = new Map<string, number>()

  const rows = el.querySelectorAll<HTMLElement>('[data-gantt-record-id]')
  for (const row of rows) {
    const id = row.dataset.ganttRecordId
    if (!id) continue
    const rect = row.getBoundingClientRect()
    nextY.set(id, rect.top - containerRect.top + scrollTop + rect.height / 2)
    const gridEl = row.closest<HTMLElement>('[data-gantt-group-grid]')
    if (gridEl && gridIndex.has(gridEl)) nextGroup.set(id, gridIndex.get(gridEl)!)
  }

  recordY.value = nextY
  recordToGroup.value = nextGroup
}

let resizeObserver: ResizeObserver | null = null
let mutationObserver: MutationObserver | null = null

watch(
  () => props.scrollAreaEl,
  (el) => {
    resizeObserver?.disconnect()
    mutationObserver?.disconnect()
    resizeObserver = null
    mutationObserver = null
    if (!el) return
    resizeObserver = new ResizeObserver(() => remeasure())
    resizeObserver.observe(el)
    // Mutations cover expand/collapse transitions which change DOM order
    // and heights without triggering ResizeObserver on the scroll area.
    mutationObserver = new MutationObserver(() => remeasure())
    mutationObserver.observe(el, { childList: true, subtree: true })
    nextTick(remeasure)
  },
  { immediate: true },
)

watch(
  [() => props.expandedGroups, rootGroup, visibleDates, colWidth],
  () => {
    nextTick(remeasure)
  },
  { deep: true },
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  mutationObserver?.disconnect()
})

// --- Arrow paths ---

interface CrossArrow {
  id: string
  d: string
  // True when both endpoints are part of the inspected record's chain
  // (transitively reachable through dependencyLinks). Drives the
  // gray → green stroke + marker switch so the chain highlight visually
  // continues across group boundaries — same UX flat mode already gets.
  highlighted: boolean
  // Drives the red palette when the edge violates the dep contract:
  //   'date-violation' — successor scheduled before predecessor finishes
  //                       (or analogous failure per connection_type)
  //   'cycle'          — edge participates in a dependency loop
  // Matches Grid.vue's flat-mode treatment so the two render layers agree.
  invalidReason: 'date-violation' | 'cycle' | null
}

// Set of row IDs reachable from the inspected record through
// dependencyLinks in either direction — same BFS Grid.vue runs for
// per-bar isRecordHighlighted. Skips hover (per-Grid local state we
// can't reach from the overlay); inspector record is enough for the
// click-to-highlight UX.
const highlightedRowIds = computed<Set<string>>(() => {
  if (!inspectorRecord.value) return new Set()
  const cols = (meta.value?.columns ?? []) as ColumnType[]
  const seedId = extractPkFromRow(inspectorRecord.value.row, cols)
  if (seedId == null) return new Set()
  const seed = String(seedId)
  const links = dependencyLinks?.value
  if (!links?.size) return new Set([seed])

  const reverse = new Map<string, string[]>()
  links.forEach((successors, predecessor) => {
    for (const succ of successors) {
      const arr = reverse.get(succ) ?? []
      arr.push(predecessor)
      reverse.set(succ, arr)
    }
  })

  const visited = new Set<string>()
  const queue = [seed]
  while (queue.length) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    for (const next of links.get(current) ?? []) if (!visited.has(next)) queue.push(next)
    for (const prev of reverse.get(current) ?? []) if (!visited.has(prev)) queue.push(prev)
  }
  return visited
})

const ARROW_HEAD_OFFSET = 2
const CORNER_RADIUS = 3
const EXIT_INSET = 10
const MIN_HORIZONTAL = 4

// Simplified bar-style bottom-drop + hook fallback. Mirrors the in-group
// path builder from Grid.vue but uses absolute Y values from recordY.
function buildPath(predRightX: number, predY: number, succLeftX: number, succY: number): string {
  const tipX = succLeftX - ARROW_HEAD_OFFSET
  // Same row (rare for cross-group): straight line
  if (Math.abs(predY - succY) < 0.5) {
    return `M ${predRightX} ${predY} L ${tipX} ${succY}`
  }
  const exitX = predRightX - EXIT_INSET
  const maxExit = tipX - CORNER_RADIUS - MIN_HORIZONTAL
  // Forward (succ below) and there's enough horizontal room → drop down then route.
  if (succY > predY && maxExit >= exitX) {
    const eX = Math.min(exitX, maxExit)
    return (
      `M ${eX} ${predY}` +
      ` L ${eX} ${succY - CORNER_RADIUS}` +
      ` A ${CORNER_RADIUS} ${CORNER_RADIUS} 0 0 0 ${eX + CORNER_RADIUS} ${succY}` +
      ` L ${tipX} ${succY}`
    )
  }
  // Constrained / overlapping forward case — hook left of successor.
  if (succY > predY) {
    const R = CORNER_RADIUS
    const hookOffset = Math.max(18, colWidth.value / 3)
    const hookX = succLeftX - hookOffset
    const dropY = Math.min(succY - 2 * R - 1, predY + R + 3)
    if (hookX < exitX - R) {
      return (
        `M ${exitX} ${predY}` +
        ` L ${exitX} ${dropY - R}` +
        ` A ${R} ${R} 0 0 1 ${exitX - R} ${dropY}` +
        ` L ${hookX + R} ${dropY}` +
        ` A ${R} ${R} 0 0 0 ${hookX} ${dropY + R}` +
        ` L ${hookX} ${succY - R}` +
        ` A ${R} ${R} 0 0 0 ${hookX + R} ${succY}` +
        ` L ${tipX} ${succY}`
      )
    }
  }
  // Upward / wide loop fallback
  const farLeftX = Math.min(succLeftX - 12, exitX - 12)
  const midY = succY > predY ? succY + 18 : succY - 18
  return (
    `M ${exitX} ${predY}` + ` L ${exitX} ${midY}` + ` L ${farLeftX} ${midY}` + ` L ${farLeftX} ${succY}` + ` L ${tipX} ${succY}`
  )
}

// Invalid-edge detection lives on the store (useGanttViewStore.invalidReasonFor)
// — single source of truth shared with the per-group Grid.vue and the
// RecordInspector so labels never disagree across views.

const arrowPaths = computed<CrossArrow[]>(() => {
  const r = range.value
  if (!r?.fk_dependency_col) return []
  const links = dependencyLinks?.value
  if (!links?.size) return []

  // Build a flat lookup of all records currently visible across groups
  // (i.e. those for which we have a measured Y).
  const recordById = new Map<string, RowType>()
  // Pull rows from rootGroup's leaf groups: traverse via the DOM-measured
  // recordY map keys + match against formattedData... but formattedData is
  // empty in grouped mode. Instead, walk rootGroup. For simplicity in
  // round 1 we read records via the rendered DOM: each lane has the
  // data-gantt-record-id, and we already have the recordToGroup map.
  // But we need the actual Row object to call recordGeometry. So we walk
  // the rootGroup tree.
  const root = rootGroup.value
  if (!root?.children?.length) return []
  for (const grp of root.children) {
    if (grp.nested) continue
    for (const row of grp.rows ?? []) {
      const id = extractPkFromRow(row.row, pkCols.value)
      if (id != null) recordById.set(String(id), row)
    }
  }

  const result: CrossArrow[] = []
  const direction = r.dependency_direction ?? 'successor'

  links.forEach((linkedIds, rowId) => {
    for (const linkedId of linkedIds) {
      const [predId, succId] = direction === 'predecessor' ? [linkedId, rowId] : [rowId, linkedId]
      const predGroup = recordToGroup.value.get(predId)
      const succGroup = recordToGroup.value.get(succId)
      // Cross-group only — skip same-group (drawn by per-group SVG before,
      // but per-group SVG is now off in grouped mode, so this also covers
      // same-group). To avoid duplication once per-group SVGs come back,
      // change this to: if (predGroup === succGroup) return
      if (predGroup === undefined || succGroup === undefined) continue

      const predRow = recordById.get(predId)
      const succRow = recordById.get(succId)
      if (!predRow || !succRow) continue

      const predGeom = recordGeometry(predRow)
      const succGeom = recordGeometry(succRow)
      const predYVal = recordY.value.get(predId)
      const succYVal = recordY.value.get(succId)
      if (!predGeom || !succGeom || predYVal === undefined || succYVal === undefined) continue

      const hiSet = highlightedRowIds.value
      result.push({
        id: `${predId}-${succId}`,
        d: buildPath(predGeom.rightX, predYVal, succGeom.leftX, succYVal),
        highlighted: hiSet.has(predId) && hiSet.has(succId),
        invalidReason: invalidReasonFor(rowId, linkedId),
      })
    }
  })

  return result
})

// SVG dimensions — fill the scroll-area content. Width follows the date
// grid; height follows the scroll area's scrollHeight so arrows can span
// the full vertical extent.
const svgHeight = computed(() => {
  const el = props.scrollAreaEl
  return el ? el.scrollHeight : 0
})

const GROUP_SIDEBAR_WIDTH = TIMELINE_GROUP_SIDEBAR_WIDTH

// Horizontal position of the SVG content. The svg is fixed inside the
// scroll-area at left: GROUP_SIDEBAR_WIDTH. We translate the inner <g>
// by -scrollLeft so the paths align with the horizontally-scrolled bars.
const innerTransform = computed(() => `translate(${-scrollLeft.value}, 0)`)
</script>

<template>
  <svg
    v-if="arrowPaths.length"
    class="absolute pointer-events-none"
    :style="{
      top: '0px',
      left: `${GROUP_SIDEBAR_WIDTH}px`,
      width: `calc(100% - ${GROUP_SIDEBAR_WIDTH}px)`,
      height: `${svgHeight}px`,
      overflow: 'hidden',
      // z=1 paints the SVG ABOVE per-Grid background layers (weekend
      // stripes, gridlines, today line — all at z=0 inside each per-Grid
      // wrapper). Bars get z=2 via the NcTooltip wrappers in Grid.vue so
      // they still cover arrows at the 2px termination tip. Final stack
      // (bottom to top): per-Grid bg (z=0) → cross-arrows (z=1) → bars
      // (z=2) → interacting bar (z=100).
      zIndex: 1,
    }"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <marker
        id="nc-gantt-xgroup-arrow-head"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--nc-border-gray-extra-dark, #9aa2af)" />
      </marker>
      <!-- Highlighted-chain variant: green head matching per-bar
           chain-highlight color used in Grid.vue. -->
      <marker
        id="nc-gantt-xgroup-arrow-head-highlighted"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--color-green-600)" />
      </marker>
      <!-- Invalid variant: red head for cycles + date violations. Matches
           the per-Grid red marker so flat and grouped modes look the same. -->
      <marker
        id="nc-gantt-xgroup-arrow-head-invalid"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--nc-content-red-dark, #b91c1c)" />
      </marker>
    </defs>
    <g :transform="innerTransform">
      <!-- Priority: invalid (red, dashed) > chain-highlighted (green) >
           default (grey). Invalid arrows use a dashed stroke so the
           broken edge is recognisable at a glance — matches Airtable's
           red-dotted-line convention. -->
      <path
        v-for="arrow in arrowPaths"
        :key="arrow.id"
        :d="arrow.d"
        fill="none"
        :stroke="
          arrow.invalidReason
            ? 'var(--nc-content-red-dark, #b91c1c)'
            : arrow.highlighted
            ? 'var(--color-green-600)'
            : 'var(--nc-border-gray-extra-dark, #9aa2af)'
        "
        :stroke-width="arrow.invalidReason ? 1.25 : 1"
        :stroke-dasharray="arrow.invalidReason ? '4 3' : undefined"
        stroke-linejoin="round"
        :marker-end="
          arrow.invalidReason
            ? 'url(#nc-gantt-xgroup-arrow-head-invalid)'
            : arrow.highlighted
            ? 'url(#nc-gantt-xgroup-arrow-head-highlighted)'
            : 'url(#nc-gantt-xgroup-arrow-head)'
        "
      >
        <title v-if="arrow.invalidReason === 'cycle'">{{ $t('msg.dependencyInvalidCycle') }}</title>
        <title v-else-if="arrow.invalidReason === 'date-violation'">{{ $t('msg.dependencyInvalidDate') }}</title>
      </path>
    </g>
  </svg>
</template>
