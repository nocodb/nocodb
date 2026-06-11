<script setup lang="ts">
/**
 * Props:
 * - `size` → Width & height of the SVG (default: 150)
 * - `value` → The filled portion of the pie (used value, optional if `percentage` is provided)
 * - `total` → The total value representing 100% (used to compute `percentage` if `percentage` is undefined)
 * - `percentage` → Directly specify the filled portion in percentage (optional, overrides `value/total` calculation if provided)
 * - `fillColor` → Color of the filled section
 * - `backgroundColor` → Color of the unfilled section
 * - `animationDuration` → How fast the animation runs (default: 250ms)
 */
interface Props {
  size?: number
  value?: number
  total?: number
  percentage?: number
  fillColor?: string
  backgroundColor?: string
  animationDuration?: number
}
const props = withDefaults(defineProps<Props>(), {
  size: 32,
  value: 0,
  total: 0,
  fillColor: '#3498db',
  backgroundColor: '#ddd',
  animationDuration: 350, // Default: 500ms
})

// Reactive state for animated percentage
const animatedPercentage = ref(0)

// Smooth animation logic
const animatePercentage = (newPercentage: number) => {
  const start = animatedPercentage.value
  const end = Math.min(newPercentage, 100) // Cap at 100%
  const duration = props.animationDuration
  const startTime = performance.now()

  const step = (timestamp: number) => {
    const progress = Math.min((timestamp - startTime) / duration, 1)
    animatedPercentage.value = start + (end - start) * progress

    if (progress < 1) {
      requestAnimationFrame(step)
    }
  }

  requestAnimationFrame(step)
}

const computedPercentage = computed(() => {
  if (props.percentage !== undefined) return Math.min(props.percentage, 100)
  if (props.total && props.value !== undefined) {
    return Math.min((props.value / props.total) * 100, 100)
  }
  return 0
})

// Watch `percentage` prop and animate changes
watch(
  computedPercentage,
  (newVal) => {
    animatePercentage(newVal)
  },
  {
    immediate: true,
  },
)

// Convert percentage to angle (0-360)
const angle = computed(() => (animatedPercentage.value / 100) * 360)

/**
 * Convert angle to SVG arc path
 */
const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
  if (endAngle === 360) {
    // If full circle, return a complete path
    return [
      'M',
      x - radius,
      y,
      'a',
      radius,
      radius,
      0,
      1,
      0,
      radius * 2,
      0,
      'a',
      radius,
      radius,
      0,
      1,
      0,
      -radius * 2,
      0,
      'Z',
    ].join(' ')
  }

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    }
  }

  const start = polarToCartesian(x, y, radius, endAngle)
  const end = polarToCartesian(x, y, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'

  return [
    'M',
    x,
    y, // Move to center
    'L',
    start.x,
    start.y, // Line to start
    'A',
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y, // Arc
    'Z', // Close path
  ].join(' ')
}
// Computed angles
const radius = computed(() => props.size / 2)

/**
 * Computed property to get arc path based on percentage
 */
const piePath = computed(() => {
  return describeArc(radius.value, radius.value, radius.value, 0, angle.value)
})
</script>

<template>
  <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
    <!-- Background Circle -->
    <circle :cx="radius" :cy="radius" :r="radius" :fill="backgroundColor" />

    <!-- Filled Portion -->
    <path :d="piePath" :fill="fillColor" />
  </svg>
</template>
