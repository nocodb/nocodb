<script lang="ts" setup>
interface SnowflakeProps {
  maxFlakes?: number
  color?: string
  minSize?: number
  maxSize?: number
  speed?: number
  symbols?: string[]
}

const props = withDefaults(defineProps<SnowflakeProps>(), {
  maxFlakes: 200,
  color: '#e0e0e0',
  minSize: 2,
  maxSize: 6,
  speed: 1,
  symbols: () => ['❄', '❅', '❆'],
})

interface Snowflake {
  x: number
  y: number
  size: number
  speedY: number
  rotation: number
  symbol: string
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null

const snowflakes: Snowflake[] = []

const canvasWidth = ref(0)
const canvasHeight = ref(0)
const mouseX = ref(0)
const mouseY = ref(0)

const random = (min: number, max: number) => Math.random() * (max - min) + min

function createSnowflake(): Snowflake {
  return {
    x: random(0, canvasWidth.value),
    y: random(-canvasHeight.value, 0),
    size: random(props.minSize, props.maxSize),
    speedY: (0.5 + Math.random()) * props.speed,
    rotation: random(0, 360),
    symbol: props.symbols[Math.floor(Math.random() * props.symbols.length)] || '❄',
  }
}

function initSnowflakes() {
  snowflakes.length = 0
  for (let i = 0; i < props.maxFlakes; i++) {
    snowflakes.push(createSnowflake())
  }
}

let rafId: number | null = null

function updateAndDrawFlakes() {
  if (!ctx) return
  ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value)
  ctx.fillStyle = props.color ?? '#e0e0e0'

  for (const flake of snowflakes) {
    const repelRange = 100
    const dx = flake.x - mouseX.value
    const dy = flake.y - mouseY.value
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < repelRange) {
      const angle = Math.atan2(dy, dx)
      const force = (repelRange - dist) / repelRange
      flake.x += Math.cos(angle) * force * 5
      flake.y += Math.sin(angle) * force * 5
    }

    flake.y += flake.speedY

    if (flake.y > canvasHeight.value + 50) {
      flake.y = -50
      flake.x = random(0, canvasWidth.value)
    }

    const fontSize = flake.size * 4
    ctx.font = `${fontSize}px sans-serif`
    ctx.save()
    ctx.translate(flake.x, flake.y)
    ctx.rotate((flake.rotation * Math.PI) / 180)
    ctx.fillText(flake.symbol, 0, 0)
    ctx.restore()
  }
}

function animate() {
  updateAndDrawFlakes()
  rafId = requestAnimationFrame(animate)
}

// Keep track of mouse events only if needed
let ticking = false
function handleMouseMove(e: MouseEvent) {
  if (!ticking) {
    ticking = true
    requestAnimationFrame(() => {
      mouseX.value = e.clientX
      mouseY.value = e.clientY
      ticking = false
    })
  }
}

function handleResize() {
  if (!canvasRef.value) return
  canvasWidth.value = window.innerWidth
  canvasHeight.value = window.innerHeight
  canvasRef.value.width = canvasWidth.value
  canvasRef.value.height = canvasHeight.value
  initSnowflakes()
}

onMounted(() => {
  if (typeof window === 'undefined') return

  if (canvasRef.value) {
    ctx = canvasRef.value.getContext('2d') || null
    handleResize()
    initSnowflakes()
    animate()
  }

  useEventListener(window, 'resize', handleResize)
  useEventListener(window, 'mousemove', handleMouseMove)
})

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
})
</script>

<template>
  <canvas ref="canvasRef" class="snow-canvas"></canvas>
</template>

<style scoped>
.snow-canvas {
  position: fixed;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 99999;
  width: 100vw;
  height: 100vh;
}
</style>
