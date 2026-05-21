<script setup lang="ts">
type PreviewKind = 'bar' | 'line' | 'pie' | 'donut' | 'scatter'

interface Props {
  colors: string[]
  preview?: PreviewKind
  size?: 'sm' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  preview: 'pie',
  size: 'sm',
})

const PREVIEW_COUNT: Record<PreviewKind, number> = {
  pie: 6,
  donut: 6,
  bar: 5,
  line: 3,
  scatter: 5,
}

const BAR_HEIGHTS = [70, 45, 90, 55, 75]

const LINE_SHAPES = [
  [70, 35, 55, 25, 40],
  [40, 60, 35, 55, 30],
  [80, 50, 70, 40, 60],
]

const SCATTER_POSITIONS = [
  { cx: 10, cy: 24 },
  { cx: 18, cy: 12 },
  { cx: 26, cy: 22 },
  { cx: 14, cy: 28 },
  { cx: 28, cy: 10 },
]

const pieGradient = (cs: string[]): string => {
  const n = cs.length
  if (!n) return 'transparent'
  const step = 100 / n
  return `conic-gradient(${cs.map((c, i) => `${c} ${(i * step).toFixed(2)}% ${((i + 1) * step).toFixed(2)}%`).join(', ')})`
}

const sliced = computed(() => {
  const n = PREVIEW_COUNT[props.preview]
  return props.colors.slice(0, Math.min(n, props.colors.length))
})

const sparkPoints = (i: number): string => {
  const ys = LINE_SHAPES[i % LINE_SHAPES.length]
  return ys.map((y, j) => `${((j / (ys.length - 1)) * 36).toFixed(1)},${((y / 100) * 32 + 2).toFixed(1)}`).join(' ')
}

const sizePx = computed(() => (props.size === 'lg' ? 36 : 22))
const isRound = computed(() => props.preview === 'pie' || props.preview === 'donut')
const holeInset = computed(() => (props.size === 'lg' ? '10px' : '6px'))
const barPad = computed(() => (props.size === 'lg' ? '5px 3px' : '3px 2px'))
const barGap = computed(() => (props.size === 'lg' ? '2px' : '1px'))
const dotRadius = computed(() => (props.size === 'lg' ? 3 : 2.5))
</script>

<template>
  <span
    class="nc-palette-preview"
    :class="{ 'nc-palette-preview-round': isRound }"
    :style="{ width: `${sizePx}px`, height: `${sizePx}px` }"
  >
    <template v-if="preview === 'pie' || preview === 'donut'">
      <span class="nc-palette-pie-fill" :style="{ background: pieGradient(sliced) }" />
      <span v-if="preview === 'donut'" class="nc-palette-pie-hole" :style="{ inset: holeInset }" />
    </template>

    <div v-else-if="preview === 'bar'" class="nc-palette-bars" :style="{ padding: barPad, gap: barGap }">
      <span v-for="(c, i) in sliced" :key="i" :style="{ background: c, height: `${BAR_HEIGHTS[i % BAR_HEIGHTS.length]}%` }" />
    </div>

    <svg v-else-if="preview === 'line'" viewBox="0 0 36 36" preserveAspectRatio="none" class="nc-palette-svg">
      <polyline
        v-for="(c, i) in sliced"
        :key="i"
        :points="sparkPoints(i)"
        :stroke="c"
        stroke-width="2.5"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>

    <svg v-else-if="preview === 'scatter'" viewBox="0 0 36 36" class="nc-palette-svg">
      <circle
        v-for="(p, i) in SCATTER_POSITIONS.slice(0, PREVIEW_COUNT.scatter)"
        :key="i"
        :cx="p.cx"
        :cy="p.cy"
        :r="dotRadius"
        :fill="colors[i % colors.length]"
      />
    </svg>
  </span>
</template>

<style>
/* Non-scoped so the preview renders correctly when ant-select copies the
   selected option's DOM into the trigger surface. */
.nc-palette-preview {
  display: inline-flex;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  border-radius: 5px;
  background: var(--nc-bg-default);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.06);
  vertical-align: middle;
}

.nc-palette-preview-round {
  border-radius: 50%;
}

.nc-palette-pie-fill {
  position: absolute;
  inset: 0;
  border-radius: 50%;
}

.nc-palette-pie-hole {
  position: absolute;
  background: var(--nc-bg-default);
  border-radius: 50%;
}

.nc-palette-bars {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
}

.nc-palette-bars > span {
  flex: 1;
  border-radius: 1px 1px 0 0;
  min-width: 1.5px;
}

.nc-palette-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
