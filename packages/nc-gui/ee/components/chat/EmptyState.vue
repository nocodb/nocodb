<script setup lang="ts">
const emit = defineEmits<{
  prompt: [text: string]
}>()

const { t } = useI18n()

const starterPrompts = computed(() => [t('msg.chat.starterDescribe'), t('msg.chat.starterRecords'), t('msg.chat.starterFilter')])
</script>

<template>
  <div class="flex flex-col items-center justify-center h-full px-6 py-8">
    <GeneralIcon icon="ncMessageSquare" class="w-12 h-12 text-nc-content-gray-subtle mb-4" />

    <h3 class="text-lg font-semibold text-nc-content-gray-emphasis mb-1">
      {{ t('labels.chatWith') }}
    </h3>

    <div class="flex flex-col gap-2 w-full max-w-sm">
      <button
        v-for="prompt in starterPrompts"
        :key="prompt"
        v-e="['c:chat:starter-prompt']"
        class="text-left text-sm px-4 py-2.5 rounded-lg border-1 border-nc-border-gray-light bg-nc-bg-default text-nc-content-gray-emphasis hover:bg-nc-bg-gray-light hover:border-nc-border-gray-medium transition-colors cursor-pointer"
        @click="emit('prompt', prompt)"
      >
        {{ prompt }}
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-chat-empty-sparkle {
  width: 80px;
  height: 60px;
}

.nc-empty-dot {
  @apply inline-block w-2.5 h-2.5 rounded-full bg-gray-300;
  animation: nc-empty-dot-pulse 1.4s ease-in-out infinite both;
}

@keyframes nc-empty-dot-pulse {
  0%,
  80%,
  100% {
    opacity: 0.35;
    transform: scale(0.85);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}

.nc-sparkle-icon {
  @apply absolute;
  animation: nc-sparkle-float 2.4s ease-in-out infinite;
  opacity: 0.7;
}

.nc-sparkle-1 {
  top: 2px;
  left: 8px;
  animation-delay: 0s;
}

.nc-sparkle-2 {
  top: 0;
  right: 14px;
  animation-delay: 0.8s;
}

.nc-sparkle-3 {
  bottom: 4px;
  left: 2px;
  animation-delay: 1.6s;
}

@keyframes nc-sparkle-float {
  0%,
  100% {
    opacity: 0.4;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}
</style>
