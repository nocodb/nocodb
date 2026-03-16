<script setup lang="ts">
import pawPixels from '~/assets/img/paw-pixels.png'

const { isPanelExpanded, hasBaseContext, toggleChatPanel } = useChatPanel()

const { isEEFeatureBlocked } = useEeConfig()

const showFab = computed(() => isEeUI && !isEEFeatureBlocked.value && !isPanelExpanded.value && hasBaseContext.value)

const isPressed = ref(false)

const handleClick = () => {
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
        class="nc-chat-fab fixed bottom-6 right-6 z-99 flex items-center h-8 rounded-full bg-nc-bg-purple-dark text-nc-content-purple-dark cursor-pointer select-none shadow-lg"
        :class="[isPressed ? 'scale-90' : 'hover:shadow-xl hover:-translate-y-0.5 active:scale-95']"
        @click="handleClick"
      >
        <div class="flex-none w-8 h-8 rounded-full overflow-hidden bg-white border-1.5 border-nc-purple-200">
          <img :src="pawPixels" alt="" class="w-full h-full object-cover" />
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
