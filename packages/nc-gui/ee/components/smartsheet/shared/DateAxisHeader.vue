<script lang="ts" setup>
/**
 * Tiered date-axis header used by Timeline and Gantt (both flat and grouped
 * layouts). Renders:
 *
 * 1. Zero or more stacked major-tier rows ("Q2 2026 / Apr / May / Jun") at
 *    20px each. Empty array when the current scale's `majorTiers` is empty
 *    (week / month).
 * 2. One minor row at `minorHeight` containing:
 *    - Sparse weekend stripes (`weekendOffsets`) — emitted only at fine
 *      zooms where `colWidth >= 30`.
 *    - Optional today-column highlight (`todayDayIdx`).
 *    - Optional hover-column highlight (`hoverColIndex`) — caller-owned
 *      hover state; omit in grouped layouts where hover isn't tracked.
 *    - Sparse vertical gridlines (`gridlineOffsets`) at the scale's cadence
 *      (day / week / fortnight / month / quarter).
 *    - Sparse weekday + day-number labels (`minorLabels`).
 *
 * All inputs are precomputed by `useDateAxisState` so coarse zooms don't
 * iterate the 1.4k–3.7k-day buffer per scroll frame.
 */

interface MajorSpan {
  key: string
  leftPx: number
  widthPx: number
  label: string
}

interface MinorLabel {
  idx: number
  leftPx: number
  weekday: string
  dayNum: string
  key: string
}

interface OffsetEntry {
  leftPx: number
  key: string
}

const props = withDefaults(
  defineProps<{
    majorHeaderTiers: MajorSpan[][]
    minorLabels: MinorLabel[]
    weekendOffsets: OffsetEntry[]
    gridlineOffsets: OffsetEntry[]
    colWidth: number
    totalGridWidth: number
    todayDayIdx: number
    minorHeight: number
    hoverColIndex?: number | null
  }>(),
  {
    hoverColIndex: null,
  },
)

const { hoverColIndex } = toRefs(props)
</script>

<template>
  <div :style="{ width: `${totalGridWidth}px` }">
    <!-- Stacked major rows (year / quarter / month etc.) — empty at fine zooms. -->
    <div
      v-for="(tier, tierIdx) in majorHeaderTiers"
      :key="`tier-${tierIdx}`"
      class="relative bg-nc-bg-default border-b border-nc-border-gray-light"
      :style="{ height: '20px' }"
    >
      <div
        v-for="span in tier"
        :key="span.key"
        class="absolute top-0 h-full flex items-center justify-start text-[11px] font-medium text-nc-content-gray-emphasis border-r border-nc-border-gray-light overflow-hidden whitespace-nowrap px-2"
        :style="{ left: `${span.leftPx}px`, width: `${span.widthPx}px` }"
      >
        {{ span.label }}
      </div>
    </div>

    <!-- Minor row — bg div + sparse overlays. -->
    <div
      class="relative bg-nc-bg-default border-b border-nc-border-gray-medium"
      :style="{ height: `${minorHeight}px`, width: `${totalGridWidth}px` }"
    >
      <!-- Weekend stripes (only at fine zooms — store filters this) -->
      <div
        v-for="off in weekendOffsets"
        :key="`hwk-${off.key}`"
        class="absolute top-0 bottom-0 bg-nc-bg-gray-extralight pointer-events-none"
        :style="{ left: `${off.leftPx}px`, width: `${colWidth}px` }"
      />
      <!-- Today column highlight -->
      <div
        v-if="todayDayIdx >= 0"
        class="absolute top-0 bottom-0 bg-nc-bg-brand pointer-events-none"
        :style="{ left: `${todayDayIdx * colWidth}px`, width: `${colWidth}px` }"
      />
      <!-- Hover column highlight — only when caller passes hoverColIndex -->
      <div
        v-if="hoverColIndex !== null && hoverColIndex !== undefined && hoverColIndex !== todayDayIdx"
        class="nc-date-axis-header-hover absolute top-0 bottom-0 pointer-events-none"
        :style="{ left: `${hoverColIndex * colWidth}px`, width: `${colWidth}px` }"
      />
      <!-- Vertical gridlines at the scale's cadence -->
      <div
        v-for="off in gridlineOffsets"
        :key="`hgl-${off.key}`"
        class="absolute top-0 bottom-0 border-r border-nc-border-gray-light pointer-events-none"
        :style="{ left: `${off.leftPx}px` }"
      />
      <!-- Sparse labels (weekday / day-number / mondays / fortnight / quarter-month) -->
      <div
        v-for="lbl in minorLabels"
        :key="`hl-${lbl.key}`"
        class="absolute top-0 bottom-0 flex flex-col items-center justify-center pointer-events-none"
        :style="{ left: `${lbl.leftPx}px`, width: `${colWidth}px` }"
      >
        <span
          v-if="lbl.weekday"
          class="text-[10px] font-normal leading-tight"
          :class="{
            'text-nc-content-brand': lbl.idx === todayDayIdx,
            'text-nc-content-gray-subtle': lbl.idx === hoverColIndex && lbl.idx !== todayDayIdx,
            'text-nc-content-gray-muted': lbl.idx !== hoverColIndex && lbl.idx !== todayDayIdx,
          }"
        >
          {{ lbl.weekday }}
        </span>
        <span
          v-if="lbl.dayNum"
          class="text-[11px] leading-tight whitespace-nowrap"
          :class="{
            'text-nc-content-brand': lbl.idx === todayDayIdx,
            'font-semibold text-nc-content-gray-emphasis': lbl.idx === hoverColIndex && lbl.idx !== todayDayIdx,
            'font-normal text-nc-content-gray-muted': lbl.idx !== hoverColIndex && lbl.idx !== todayDayIdx,
          }"
        >
          {{ lbl.dayNum }}
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* Header column highlight on hover */
.nc-date-axis-header-hover {
  @apply bg-nc-bg-gray-light/50;
}
</style>
