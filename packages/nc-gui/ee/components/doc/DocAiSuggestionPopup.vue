<script setup lang="ts">
interface Props {
  loading: boolean
  result: string
  error: string
  operationLabel: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  result: '',
  error: '',
  operationLabel: '',
})

const { loading, result, error } = toRefs(props)

const emit = defineEmits<{
  (e: 'accept'): void
  (e: 'discard'): void
  (e: 'tryAgain'): void
  (e: 'insertBelow'): void
  (e: 'stop'): void
}>()

const { t } = useI18n()

const popupRef = ref<HTMLElement>()

const hasResult = computed(() => !!result.value && !loading.value)

const hasError = computed(() => !!error.value && !loading.value)

onClickOutside(popupRef, () => emit('discard'))

useEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('discard')
  } else if (e.key === 'Enter' && hasResult.value) {
    e.preventDefault()
    emit('accept')
  }
})
</script>

<template>
  <div ref="popupRef" class="nc-doc-ai-suggestion" data-testid="nc-doc-ai-suggestion">
    <!-- Loading state -->
    <div v-if="loading" class="nc-doc-ai-suggestion-loading">
      <div class="nc-doc-ai-suggestion-icon">
        <GeneralIcon icon="ncAutoAwesome" class="text-nc-content-brand" />
      </div>
      <div class="nc-doc-ai-suggestion-thinking">
        <span class="nc-doc-ai-suggestion-brand">NocoAI</span>
        <span class="nc-doc-ai-suggestion-thinking-text">{{ t('labels.docAiThinking') }}</span>
        <span class="nc-doc-ai-suggestion-dots">
          <span class="dot dot-1" />
          <span class="dot dot-2" />
          <span class="dot dot-3" />
        </span>
      </div>
      <NcButton
        size="xs"
        type="text"
        class="nc-doc-ai-suggestion-stop !rounded-full"
        data-testid="nc-doc-ai-suggestion-stop"
        @click="emit('stop')"
      >
        <GeneralIcon icon="ncStopCircle" class="text-nc-content-gray-subtle" />
      </NcButton>
    </div>

    <!-- Result state -->
    <template v-if="hasResult">
      <div class="nc-doc-ai-suggestion-header">
        <div class="nc-doc-ai-suggestion-icon">
          <GeneralIcon icon="ncAutoAwesome" class="text-nc-content-brand" />
        </div>
        <span class="nc-doc-ai-suggestion-brand">NocoAI</span>
        <span class="nc-doc-ai-suggestion-header-dot" />
        <span class="nc-doc-ai-suggestion-label text-nc-content-gray-subtle">{{ operationLabel }}</span>
      </div>
      <div class="nc-doc-ai-suggestion-content" data-testid="nc-doc-ai-suggestion-content">
        {{ result }}
      </div>
      <div class="nc-doc-ai-suggestion-actions">
        <NcButton
          v-e="['c:doc:ai:suggestion:accept']"
          size="xs"
          type="secondary"
          data-testid="nc-doc-ai-suggestion-accept"
          @click="emit('accept')"
        >
          <div class="flex items-center gap-1">
            <GeneralIcon icon="check" class="!h-3.5 !w-3.5" />
            <span>{{ t('labels.docAiAccept') }}</span>
          </div>
        </NcButton>
        <NcButton
          v-e="['c:doc:ai:suggestion:discard']"
          size="xs"
          type="text"
          class="nc-doc-ai-suggestion-discard-btn"
          data-testid="nc-doc-ai-suggestion-discard"
          @click="emit('discard')"
        >
          <div class="flex items-center gap-1">
            <GeneralIcon icon="close" class="!h-3.5 !w-3.5" />
            <span>{{ t('labels.docAiDiscard') }}</span>
          </div>
        </NcButton>
        <NcButton
          v-e="['c:doc:ai:suggestion:tryAgain']"
          size="xs"
          type="text"
          data-testid="nc-doc-ai-suggestion-try-again"
          @click="emit('tryAgain')"
        >
          <div class="flex items-center gap-1">
            <GeneralIcon icon="refresh" class="!h-3 !w-3" />
            <span>{{ t('labels.docAiTryAgain') }}</span>
          </div>
        </NcButton>
        <NcButton
          v-e="['c:doc:ai:suggestion:insertBelow']"
          size="xs"
          type="text"
          data-testid="nc-doc-ai-suggestion-insert-below"
          @click="emit('insertBelow')"
        >
          <div class="flex items-center gap-1">
            <GeneralIcon icon="ncListEnd" class="!h-3.5 !w-3.5" />
            <span>{{ t('labels.docAiInsertBelow') }}</span>
          </div>
        </NcButton>
      </div>
    </template>

    <!-- Error state -->
    <template v-if="hasError">
      <div class="nc-doc-ai-suggestion-header">
        <div class="nc-doc-ai-suggestion-icon">
          <GeneralIcon icon="ncAutoAwesome" class="text-nc-content-red-dark" />
        </div>
        <span class="nc-doc-ai-suggestion-brand">NocoAI</span>
        <span class="nc-doc-ai-suggestion-header-dot" />
        <span class="nc-doc-ai-suggestion-error-text text-nc-content-red-dark">{{ error }}</span>
      </div>
      <div class="nc-doc-ai-suggestion-actions">
        <NcButton
          size="xs"
          type="text"
          data-testid="nc-doc-ai-suggestion-retry"
          @click="emit('tryAgain')"
        >
          <div class="flex items-center gap-1">
            <GeneralIcon icon="refresh" class="!h-3 !w-3" />
            <span>{{ t('labels.docAiTryAgain') }}</span>
          </div>
        </NcButton>
        <NcButton
          size="xs"
          type="text"
          class="nc-doc-ai-suggestion-discard-btn"
          data-testid="nc-doc-ai-suggestion-error-discard"
          @click="emit('discard')"
        >
          <div class="flex items-center gap-1">
            <GeneralIcon icon="close" class="!h-3.5 !w-3.5" />
            <span>{{ t('labels.docAiDiscard') }}</span>
          </div>
        </NcButton>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-doc-ai-suggestion {
  @apply flex flex-col;
  background: var(--nc-bg-default);
  border: 1px solid var(--nc-border-gray-medium);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  width: 560px;
  z-index: 50;
  overflow: hidden;
}

.nc-doc-ai-suggestion-loading {
  @apply flex items-center gap-2 px-3.5 py-3;
}

.nc-doc-ai-suggestion-icon {
  @apply flex items-center justify-center flex-shrink-0 w-6 h-6;
}

.nc-doc-ai-suggestion-thinking {
  @apply flex items-center gap-1.5 flex-1;
}

.nc-doc-ai-suggestion-brand {
  @apply text-bodySm font-semibold text-nc-content-brand;
}

.nc-doc-ai-suggestion-header-dot {
  @apply flex-shrink-0 rounded-full bg-nc-content-gray-subtle2;
  width: 3px;
  height: 3px;
}

.nc-doc-ai-suggestion-thinking-text {
  @apply text-bodySm text-nc-content-gray-subtle font-medium;
}

.nc-doc-ai-suggestion-dots {
  @apply flex items-center gap-0.5;

  .dot {
    @apply rounded-full;
    width: 5px;
    height: 5px;
    animation: dotPulse 1.4s ease-in-out infinite;

    &.dot-1 {
      background: #f59e0b;
      animation-delay: 0s;
    }
    &.dot-2 {
      background: #6366f1;
      animation-delay: 0.2s;
    }
    &.dot-3 {
      background: #3b82f6;
      animation-delay: 0.4s;
    }
  }
}

@keyframes dotPulse {
  0%, 80%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}

.nc-doc-ai-suggestion-stop {
  @apply flex-shrink-0;
}

.nc-doc-ai-suggestion-header {
  @apply flex items-center gap-2 px-3.5 pt-3 pb-1;
}

.nc-doc-ai-suggestion-label {
  @apply text-captionSm font-medium;
}

.nc-doc-ai-suggestion-content {
  @apply px-3.5 py-2 text-bodySm text-nc-content-gray leading-relaxed;
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
}

.nc-doc-ai-suggestion-error-text {
  @apply text-bodySm font-medium;
}

.nc-doc-ai-suggestion-actions {
  @apply flex items-center gap-1.5 px-2.5 py-2;
  border-top: 1px solid var(--nc-border-gray-light);
}

.nc-doc-ai-suggestion-discard-btn {
  &:hover {
    @apply !text-nc-content-red-dark;
  }
}
</style>
