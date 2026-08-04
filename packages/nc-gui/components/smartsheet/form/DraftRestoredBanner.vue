<script lang="ts" setup>
import dayjs from 'dayjs'

interface Props {
  restoredAt: number | null
}

const props = defineProps<Props>()

const emits = defineEmits<{
  (e: 'discard'): void
  (e: 'close'): void
}>()

const { t } = useI18n()

const now = ref(Date.now())

let intvl: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  intvl = setInterval(() => {
    now.value = Date.now()
  }, 30_000)
})

onBeforeUnmount(() => {
  if (intvl) clearInterval(intvl)
})

const relativeTime = computed(() => {
  if (!props.restoredAt) return ''
  // bind `now` so the computed re-evaluates whenever the tick interval updates it
  const _tick = now.value
  return _tick ? dayjs(props.restoredAt).fromNow() : ''
})

function discard() {
  emits('discard')
}

function close() {
  emits('close')
}
</script>

<template>
  <div class="nc-form-draft-restored-banner" role="status" aria-live="polite" data-testid="nc-form-draft-restored-banner">
    <div class="nc-form-draft-restored-icon">
      <GeneralIcon icon="ncSave" class="!w-3.5 !h-3.5 text-nc-content-brand" />
    </div>

    <span class="nc-form-draft-restored-text">
      {{ t('msg.info.formDraftRestored', { time: relativeTime }) }}
    </span>

    <button
      v-e="['c:form-share:draft-discard']"
      type="button"
      data-testid="nc-form-draft-discard-btn"
      class="nc-draft-discard-btn"
      @click="discard"
    >
      {{ t('labels.discard') }}
    </button>

    <button
      v-e="['c:form-share:draft-banner-close']"
      type="button"
      data-testid="nc-form-draft-close-btn"
      class="nc-draft-close-btn"
      :aria-label="t('general.close')"
      @click="close"
    >
      <GeneralIcon icon="close" class="!w-3.5 !h-3.5" />
    </button>
  </div>
</template>

<style lang="scss" scoped>
.nc-form-draft-restored-banner {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.75rem 0.5rem 0.625rem;
  border-radius: 8px;
  background: linear-gradient(
    180deg,
    var(--nc-bg-brand) 0%,
    color-mix(in srgb, var(--nc-bg-brand) 55%, var(--nc-bg-default)) 100%
  );
  border: 1px solid color-mix(in srgb, var(--nc-content-brand) 14%, transparent);
  box-shadow: 0 1px 1.5px color-mix(in srgb, var(--nc-content-brand) 5%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--nc-bg-default) 50%, transparent);
  animation: nc-draft-banner-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.nc-form-draft-restored-icon {
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--nc-bg-default);
  border-radius: 6px;
  flex-shrink: 0;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--nc-content-brand) 10%, transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--nc-content-brand) 12%, transparent);
}

.nc-form-draft-restored-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 500;
  color: var(--nc-content-gray);
  letter-spacing: -0.005em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nc-draft-discard-btn {
  flex-shrink: 0;
  margin: 0;
  padding: 2px 6px;
  background: transparent;
  border: 0;
  border-radius: 4px;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--nc-content-brand);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;

  &:hover {
    background: color-mix(in srgb, var(--nc-content-brand) 10%, transparent);
  }

  &:active {
    background: color-mix(in srgb, var(--nc-content-brand) 16%, transparent);
  }

  &:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--nc-content-brand) 40%, transparent);
    outline-offset: 2px;
  }
}

.nc-draft-close-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  margin: 0;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 4px;
  color: var(--nc-content-gray-subtle);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;

  &:hover {
    background: color-mix(in srgb, var(--nc-content-gray) 10%, transparent);
    color: var(--nc-content-gray);
  }

  &:active {
    background: color-mix(in srgb, var(--nc-content-gray) 16%, transparent);
  }

  &:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--nc-content-brand) 40%, transparent);
    outline-offset: 2px;
  }
}

@keyframes nc-draft-banner-in {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .nc-form-draft-restored-banner {
    animation: none;
  }
}
</style>
