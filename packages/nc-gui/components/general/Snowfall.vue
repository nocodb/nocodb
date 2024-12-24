<script lang="ts" setup>
interface SnowflakeProps {
  maxFlakes?: number
  color?: string
  minSize?: number
  maxSize?: number
  speed?: number
  enableRepel?: boolean
}

interface Snowflake {
  id: number
  x: number
  y: number
  size: number
  speed: number
  content: string
  horizontalDrift: number
  rotation: number
  style: Record<string, string>
}

const props = withDefaults(defineProps<SnowflakeProps>(), {
  maxFlakes: 200,
  color: '#e0e0e0',
  minSize: 2,
  maxSize: 6,
  speed: 1,
  enableRepel: true,
})

const snowflakes = ref<Snowflake[]>([])
const snowfallContainer = ref<HTMLDivElement | null>(null)
const containerWidth = ref(0)
const containerHeight = ref(0)

const mouseX = ref(0)
const mouseY = ref(0)

// Symbol set for snowflakes
const snowflakeSymbols = ['❄', '❅', '❆']

// A random helper
const random = (min: number, max: number) => Math.random() * (max - min) + min

function createSnowflake(id: number): Snowflake {
  const width = containerWidth.value
  const height = containerHeight.value

  const flake: Snowflake = {
    id,
    x: Math.random() * width, // random horizontal position in px
    y: Math.random() * (height * 1.1) - height * 0.1, // slightly above or below the container
    size: props.minSize + Math.random() * (props.maxSize - props.minSize),
    speed: (0.5 + Math.random()) * props.speed, // random speed factor
    content: snowflakeSymbols[Math.floor(Math.random() * snowflakeSymbols.length)] || '❄',
    horizontalDrift: random(-15, 15),
    rotation: random(-360, 360),
    style: {},
  }

  flake.style = getSnowflakeStyle(flake)
  return flake
}

function getSnowflakeStyle(snowflake: Snowflake): Record<string, string> {
  return {
    position: 'absolute',
    color: props.color,
    width: `${snowflake.size}px`,
    height: `${snowflake.size}px`,
    fontSize: `${snowflake.size * 4}px`,
    transform: `translate3d(${snowflake.x}px, ${snowflake.y}px, 0) rotate(${snowflake.rotation}deg)`,
    willChange: 'transform',
    pointerEvents: 'none',
  }
}

function updateSnowflakePosition(flake: Snowflake) {
  if (!snowfallContainer.value) return

  // If repel is enabled, apply "mouse repel" effect
  if (props.enableRepel) {
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
  }

  // Move downward
  flake.y += flake.speed

  // If the flake goes below the container, recycle it at the top
  if (flake.y > containerHeight.value + 50) {
    flake.y = -50
    flake.x = Math.random() * containerWidth.value
  }

  // Update style after position change
  flake.style = getSnowflakeStyle(flake)
}

function updateSnowflakes() {
  snowflakes.value.forEach((flake) => {
    updateSnowflakePosition(flake)
  })

  // pause on inactive tab:
  if (!document.hidden) requestAnimationFrame(updateSnowflakes)
  else setTimeout(updateSnowflakes, 500)
}

let ticking = false
function handleMouseMove(event: MouseEvent) {
  if (!ticking) {
    ticking = true
    requestAnimationFrame(() => {
      mouseX.value = event.clientX
      mouseY.value = event.clientY
      ticking = false
    })
  }
}

function handleResize() {
  if (!snowfallContainer.value) return
  containerWidth.value = snowfallContainer.value.clientWidth
  containerHeight.value = snowfallContainer.value.clientHeight
}

onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize)
  window.addEventListener('mousemove', handleMouseMove)

  // Create all flakes up front
  for (let i = 0; i < props.maxFlakes; i++) {
    snowflakes.value.push(createSnowflake(i))
  }

  // Kick off animation
  updateSnowflakes()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('mousemove', handleMouseMove)
})
</script>

<template>
  <div ref="snowfallContainer" class="snowfall-container">
    <div v-for="flake in snowflakes" :key="flake.id" class="snowflake" :style="flake.style">
      {{ flake.content }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.snowfall-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
  z-index: 99999;
}

.snowflake {
  user-select: none;
}
</style>
