<script setup lang="ts">
/**
 * "Run agent" for a custom agent field, outside the grid canvas (cell editors,
 * expanded record). `button`: solid play glyph, gray at rest, AI purple on hover.
 * `footer`: a strip under a field's input box — attached to it, or a separate
 * box. Empty field: a "Run agent" chip; filled field: an icon-only re-run.
 */
interface Props {
  source: 'cell' | 'expanded-record'
  loading?: boolean
  disabled?: boolean
  /** Icon-only by default, with the label as a tooltip. */
  showLabel?: boolean
  variant?: 'button' | 'footer'
  /** Footer only: join the input box above instead of sitting apart from it. */
  attached?: boolean
  /** Footer only: the field already has a value, so offer a re-run instead. */
  hasValue?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  disabled: false,
  showLabel: false,
  variant: 'button',
  attached: false,
  hasValue: false,
})

const emit = defineEmits<{ click: [] }>()

const { source, loading, disabled, showLabel, variant, attached, hasValue } = toRefs(props)
</script>

<template>
  <div v-if="variant === 'footer'" class="nc-field-agent-run-footer" :class="{ 'nc-attached': attached }">
    <template v-if="hasValue">
      <GeneralIcon icon="ncAutoAwesome" class="nc-field-agent-run-marker" />
      <NcTooltip :title="$t('labels.fieldAgent.runAgentAgain')" :disabled="loading" placement="bottom" class="ml-auto">
        <button
          v-e="['c:custom-agent:cell:run', { source, rerun: true }]"
          type="button"
          class="nc-field-agent-run-chip !p-1.5"
          :aria-label="$t('labels.fieldAgent.runAgentAgain')"
          :disabled="disabled || loading"
          data-testid="nc-field-agent-rerun-btn"
          @click.stop="emit('click')"
        >
          <GeneralLoader v-if="loading" size="small" class="flex-none !text-current" />
          <GeneralIcon v-else icon="ncRefreshCw" class="h-3 w-3 flex-none" />
        </button>
      </NcTooltip>
    </template>

    <NcTooltip v-else :title="$t('labels.fieldAgent.runAgent')" :disabled="loading" placement="bottom">
      <button
        v-e="['c:custom-agent:cell:run', { source }]"
        type="button"
        class="nc-field-agent-run-chip"
        :disabled="disabled || loading"
        data-testid="nc-field-agent-run-btn"
        @click.stop="emit('click')"
      >
        <GeneralLoader v-if="loading" size="small" class="flex-none !text-current" />
        <svg v-else viewBox="0 0 12 12" class="h-2.5 w-2.5 flex-none" aria-hidden="true">
          <path d="M3 1.5v9l7-4.5z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
        </svg>
        <span>{{ loading ? $t('general.generating') : $t('labels.fieldAgent.runAgent') }}</span>
      </button>
    </NcTooltip>
  </div>

  <NcTooltip v-else :title="$t('labels.fieldAgent.runAgent')" :disabled="showLabel" placement="top">
    <NcButton
      v-e="['c:custom-agent:cell:run', { source }]"
      size="xs"
      type="text"
      class="nc-field-agent-run-btn flex-none"
      :class="{ '!px-1': !showLabel }"
      :loading="loading"
      :disabled="disabled || loading"
      data-testid="nc-field-agent-run-btn"
      @click.stop="emit('click')"
    >
      <div class="flex items-center gap-1.5">
        <svg v-if="!loading" viewBox="0 0 12 12" class="h-2.5 w-2.5 flex-none" aria-hidden="true">
          <path d="M3 1.5v9l7-4.5z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
        </svg>
        <span v-if="showLabel">{{ $t('labels.fieldAgent.runAgent') }}</span>
      </div>
    </NcButton>
  </NcTooltip>
</template>

<style lang="scss" scoped>
.nc-field-agent-run-btn {
  @apply !text-nc-content-gray hover:!text-nc-content-purple-dark;
}

.nc-field-agent-run-footer {
  @apply w-full flex items-center px-1.5 py-1 border-1 border-nc-border-gray-medium rounded-lg bg-nc-bg-gray-extralight;

  &.nc-attached {
    @apply -mt-px rounded-t-none;
  }
}

.nc-field-agent-run-marker {
  @apply h-4 w-4 mx-1.5 my-1.5 flex-none text-nc-content-purple-dark;
}

.nc-field-agent-run-chip {
  @apply flex items-center gap-2 px-1.5 py-1 rounded-md text-bodyDefaultSm text-nc-content-purple-dark transition-colors;

  &:not(:disabled):hover {
    @apply bg-nc-bg-purple-light;
  }

  &:disabled {
    @apply cursor-default;
  }
}
</style>
