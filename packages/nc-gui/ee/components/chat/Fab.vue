<script setup lang="ts">
import pawPixels from '~/assets/img/paw-pixels.png'

const { isPanelExpanded, hasBaseContext, toggleChatPanel } = useChatPanel()

const { blockAiChat } = useEeConfig()

const { isRtl } = useRtl()

const showFab = computed(() => isEeUI && !blockAiChat.value && !isPanelExpanded.value && hasBaseContext.value)

const isPressed = ref(false)
const isDragging = ref(false)

const EDGE_MARGIN = 16

const fabPosition = ref({ x: -1, y: -1 })

const fabStyle = computed(() => {
  if (fabPosition.value.x < 0 || fabPosition.value.y < 0) return {}
  return {
    right: 'auto',
    bottom: 'auto',
    left: `${fabPosition.value.x}px`,
    top: `${fabPosition.value.y}px`,
  }
})

const clampPosition = (x: number, y: number, el: HTMLElement) => {
  const rect = el.getBoundingClientRect()
  const maxX = window.innerWidth - rect.width - EDGE_MARGIN
  const maxY = window.innerHeight - rect.height - EDGE_MARGIN
  return {
    x: Math.max(EDGE_MARGIN, Math.min(x, maxX)),
    y: Math.max(EDGE_MARGIN, Math.min(y, maxY)),
  }
}

const onPointerDown = (e: PointerEvent) => {
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const offsetX = e.clientX - rect.left
  const offsetY = e.clientY - rect.top
  const startX = e.clientX
  const startY = e.clientY
  let moved = false

  const onPointerMove = (moveEvent: PointerEvent) => {
    const dx = moveEvent.clientX - startX
    const dy = moveEvent.clientY - startY

    if (!moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return

    moved = true
    isDragging.value = true

    const rawX = moveEvent.clientX - offsetX
    const rawY = moveEvent.clientY - offsetY
    const clamped = clampPosition(rawX, rawY, el)
    fabPosition.value = clamped
  }

  const onPointerUp = () => {
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)

    if (moved) {
      // Suppress the click that follows drag
      setTimeout(() => {
        isDragging.value = false
      }, 0)
    }
  }

  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp)
}

const handleClick = () => {
  if (isDragging.value) return

  isPressed.value = true
  toggleChatPanel()
  setTimeout(() => {
    isPressed.value = false
  }, 300)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="nc-fab-slide">
      <div
        v-if="showFab"
        v-e="['c:chat:fab-open']"
        class="nc-chat-fab fixed z-99 flex items-center h-8 rounded-full bg-nc-bg-purple-dark text-nc-content-purple-dark cursor-pointer select-none shadow-lg"
        :class="[
          isPressed ? 'scale-90' : isDragging ? 'cursor-grabbing' : 'hover:shadow-xl hover:-translate-y-0.5 active:scale-95',
          { 'bottom-6': fabPosition.x < 0, 'right-6': fabPosition.x < 0 && !isRtl, 'left-6': fabPosition.x < 0 && isRtl },
        ]"
        :style="fabStyle"
        @pointerdown="onPointerDown"
        @click="handleClick"
      >
        <div class="flex-none w-8 h-8 rounded-full overflow-hidden bg-white border-1.5 border-nc-purple-200">
          <img :src="pawPixels" alt="" class="w-full h-full object-cover pointer-events-none" />
        </div>
        <span class="text-bodySm font-semibold whitespace-nowrap pl-2 pr-3">
          {{ $t('labels.newChat') }}
        </span>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.nc-chat-fab {
  transition: transform 150ms ease, box-shadow 150ms ease;
  touch-action: none;
}

.nc-fab-slide-enter-active {
  transition: opacity 300ms ease-out, transform 300ms ease-out;
}

.nc-fab-slide-leave-active {
  transition: opacity 200ms ease-in, transform 200ms ease-in;
}

.nc-fab-slide-enter-from,
.nc-fab-slide-leave-to {
  opacity: 0;
  transform: translateY(24px);
}
</style>
