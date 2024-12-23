<script lang="ts" setup>
const props = defineProps({
  maxFlakes: { type: Number, default: 200 },
  color: { type: String, default: '#fff' },
  minSize: { type: Number, default: 2 },
  maxSize: { type: Number, default: 6 },
  speed: { type: Number, default: 1 },
})

const snowflakes = ref([])
const snowfallContainer = ref(null)
const containerWidth = ref(0)
const containerHeight = ref(0)
const mouseX = ref(0)
const mouseY = ref(0)

const createSnowflake = (id) => ({
  id,
  x: Math.random() * 100,
  y: Math.random() * 110 - 10,
  size: props.minSize + Math.random() * (props.maxSize - props.minSize),
  speed: (0.5 + Math.random()) * props.speed,
  wobble: Math.random() * 100,
})

const getSnowflakeStyle = computed(() => (snowflake) => ({
  position: 'absolute',
  color: props.color,
  fontSize: `${snowflake.size}px`,
  left: `${snowflake.x}%`,
  top: `${snowflake.y}%`,
  background: '#e0e0e0',
  height: `${snowflake.size}px`,
  width: `${snowflake.size}px`,
  animation: `fall ${30 / snowflake.speed}s linear infinite, wobble ${5 + snowflake.wobble / 10}s ease-in-out infinite alternate`,
}))

const updateSnowflakePosition = (snowflake) => {
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

const handleMouseMove = (event) => {
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
  <div ref="snowfallContainer" class="snowfall-container" @mousemove="handleMouseMove">
    <div
      v-for="snowflake in snowflakes"
      :key="snowflake.id"
      class="snowflake rounded-full"
      :style="getSnowflakeStyle(snowflake)"
    ></div>
  </div>
</template>

<style scoped>
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

@keyframes fall {
  100% {
    transform: translateY(110vh);
  }
}

@keyframes wobble {
  50% {
    transform: translateX(5px);
  }
}
</style>
