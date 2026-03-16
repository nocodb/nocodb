<script setup lang="ts">
interface Props {
  sessionId: string
  messageId: string
}

const props = defineProps<Props>()

const chatStore = useChatStore()

const feedback = ref<'up' | 'down' | null>(null)

const handleFeedback = async (value: 'up' | 'down') => {
  feedback.value = feedback.value === value ? null : value
  await chatStore.messageFeedback(props.sessionId, props.messageId, value === 'up' ? 1 : 0)
}
</script>

<template>
  <div class="flex items-center gap-1.5 mt-3">
    <div
      v-e="['c:chat:feedback:up']"
      class="nc-feedback-btn"
      :class="{ 'nc-feedback-btn--active': feedback === 'up' }"
      @click="handleFeedback('up')"
    >
      <GeneralIcon icon="ncThumbsUp" class="w-3 h-3" />
    </div>
    <div
      v-e="['c:chat:feedback:down']"
      class="nc-feedback-btn"
      :class="{ 'nc-feedback-btn--active': feedback === 'down' }"
      @click="handleFeedback('down')"
    >
      <GeneralIcon icon="ncThumbsDown" class="w-3 h-3" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-feedback-btn {
  @apply flex items-center justify-center
    w-6 h-6 rounded
    text-nc-content-gray-subtle
    transition-colors duration-150
    cursor-pointer;

  :deep(svg) {
    @apply w-3 h-3;
  }

  &:hover {
    @apply bg-nc-bg-gray-light text-nc-content-gray;
  }

  &--active {
    @apply bg-nc-bg-brand text-nc-content-brand;
  }
}
</style>
