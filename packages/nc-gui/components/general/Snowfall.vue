<script lang="ts" setup>
interface SnowflakeProps {
  maxFlakes?: number
  color?: string
  minSize?: number
  maxSize?: number
  speed?: number
}

const props = withDefaults(defineProps<SnowflakeProps>(), {
  maxFlakes: 200,
  color: '#e0e0e0',
  minSize: 2,
  maxSize: 6,
  speed: 1,
})

interface Snowflake {
  id: number
  x: number
  y: number
  size: number
  speed: number
  content: string
  horizontalDrift: number
  rotation: number
}

const random = (min: number, max: number) => Math.random() * (max - min) + min

const snowflakes = ref<Snowflake[]>([])
const snowfallContainer = ref<HTMLDivElement | null>(null)
const containerWidth = ref(0)
const containerHeight = ref(0)
const mouseX = ref(0)
const mouseY = ref(0)

const snowflakeSymbols = ['❄', '❅', '❆']

const createSnowflake = (id: number): Snowflake => ({
  id,
  x: Math.random() * 100,
  y: Math.random() * 110 - 10,
  size: props.minSize + Math.random() * (props.maxSize - props.minSize),
  speed: (0.5 + Math.random()) * props.speed,
  content: snowflakeSymbols[Math.floor(Math.random() * snowflakeSymbols.length)],
  horizontalDrift: random(-15, 15),
  rotation: random(-360, 360),
})

const getSnowflakeStyle = (snowflake: Snowflake) => ({
  'position': 'absolute',
  'left': `${snowflake.x}%`,
  'top': `${snowflake.y}%`,
  'color': props.color,
  'width': `${snowflake.size}px`,
  'height': `${snowflake.size}px`,
  'font-size': `${snowflake.size * 4}px`,
  'animation': `fall ${30 / snowflake.speed}s linear infinite`,
  '--horizontal-drift': `${snowflake.horizontalDrift}vw`,
  '--rotation': `${snowflake.rotation}deg`,
})

const updateSnowflakePosition = (snowflake: Snowflake) => {
  if (!snowfallContainer.value) return

  const dx = (snowflake.x / 100) * containerWidth.value - mouseX.value
  const dy = (snowflake.y / 100) * containerHeight.value - mouseY.value
  const distance = Math.sqrt(dx * dx + dy * dy)
  const repelRange = 100

  if (distance < repelRange) {
    const angle = Math.atan2(dy, dx)
    const force = (repelRange - distance) / repelRange
    snowflake.x += ((Math.cos(angle) * force * 5) / containerWidth.value) * 100
    snowflake.y += ((Math.sin(angle) * force * 5) / containerHeight.value) * 100
  }
}

const updateSnowflakes = () => {
  snowflakes.value.forEach((snowflake) => {
    updateSnowflakePosition(snowflake)
    snowflake.y += snowflake.speed * 0.1
    if (snowflake.y > 110) {
      snowflake.y = -10
      snowflake.x = Math.random() * 100
    }

    snowflake.x = Math.max(0, Math.min(100, snowflake.x))
    snowflake.y = Math.max(-10, Math.min(110, snowflake.y))
  })
  requestAnimationFrame(updateSnowflakes)
}

const handleResize = () => {
  if (snowfallContainer.value) {
    containerWidth.value = snowfallContainer.value.clientWidth
    containerHeight.value = snowfallContainer.value.clientHeight
  }
}

const handleMouseMove = (event: MouseEvent) => {
  mouseX.value = event.clientX
  mouseY.value = event.clientY
}

onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize)
  window.addEventListener('mousemove', handleMouseMove)

  for (let i = 0; i < props.maxFlakes; i++) {
    snowflakes.value.push(createSnowflake(i))
  }

  updateSnowflakes()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('mousemove', handleMouseMove)
})
</script>

<template>
  <div ref="snowfallContainer" class="snowfall-container">
    <div v-for="snowflake in snowflakes" class="snowflake" :style="getSnowflakeStyle(snowflake)">
      {{ snowflake.content }}
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
  pointer-events: none;
  overflow: hidden;
  z-index: 99999;
}

.snowflake {
  @apply select-none;

  will-change: transform;
}
</style>
