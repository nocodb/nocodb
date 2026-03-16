<script setup lang="ts">
const chatStore = useChatStore()

const { agentLabel, isSendingMessage } = storeToRefs(chatStore)

const { t } = useI18n()

const displayLabel = computed(() => agentLabel.value || t('msg.chat.thinking'))
</script>

<template>
  <Transition name="nc-agent-status">
    <div v-if="isSendingMessage" class="nc-chat-agent-status flex items-center gap-2 px-3 py-2">
      <span class="nc-status-dot" />
      <span class="nc-text-shimmer truncate">{{ displayLabel }}</span>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.nc-text-shimmer {
  --base-color: var(--nc-content-brand);
  --shimmer-color: #a78bfa;

  font-size: 14px;
  font-weight: 600;
  color: transparent;
  background: linear-gradient(90deg, transparent 33%, var(--shimmer-color) 50%, transparent 67%) var(--base-color);
  background-size: 300% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  animation: nc-shimmer-slide 2s ease-in-out infinite;
}

.nc-status-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--nc-content-brand);
  animation: nc-dot-pulse 2s ease-in-out infinite;
}

@keyframes nc-shimmer-slide {
  0% {
    background-position: 100% center;
  }
  100% {
    background-position: -100% center;
  }
}

@keyframes nc-dot-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.75);
  }
}

.nc-chat-agent-status {
  animation: nc-agent-fade-in 200ms ease;
}

.nc-agent-status-enter-active,
.nc-agent-status-leave-active {
  transition: all 150ms ease;
}

.nc-agent-status-enter-from,
.nc-agent-status-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@keyframes nc-agent-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
