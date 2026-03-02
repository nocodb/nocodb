<script lang="ts" setup>
interface Props {
  label?: string
  tooltip?: string
  disableTooltip?: boolean
  icon?: string
  activeIcon?: string
  active?: boolean
  disabled?: boolean
  accentColor?: string
  indicatorColor?: string
  panelKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  tooltip: '',
  icon: undefined,
  activeIcon: undefined,
  active: false,
  disabled: false,
  accentColor: undefined,
  indicatorColor: undefined,
  panelKey: undefined,
})

const emits = defineEmits<{
  (e: 'click'): void
}>()

const tooltipText = computed(() => props.tooltip || props.label)

const currentIcon = computed(() => {
  if (props.active && props.activeIcon) return props.activeIcon
  return props.icon
})

const itemStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.accentColor) style['--rail-item-accent'] = props.accentColor
  if (props.indicatorColor) style['--rail-item-indicator'] = props.indicatorColor
  return style
})
</script>

<template>
  <NcTooltip
    class="w-full flex justify-center relative"
    placement="right"
    :arrow="false"
    :disabled="!tooltipText || disableTooltip"
  >
    <template #title>{{ tooltipText }}</template>

    <div
      class="nc-rail-item"
      :class="{ active, disabled }"
      :style="itemStyle"
      :data-panel="panelKey"
      @click="!disabled && emits('click')"
    >
      <!-- Active indicator bar -->
      <span class="nc-rail-item-indicator" />

      <slot v-if="$slots.default" />

      <template v-else>
        <slot name="icon">
          <GeneralIcon v-if="currentIcon" :icon="(currentIcon as any)" class="nc-rail-item-icon" />
        </slot>
      </template>

      <span v-if="label || $slots.label" class="nc-rail-item-label">
        <slot name="label">{{ label }}</slot>
      </span>
    </div>
  </NcTooltip>
</template>

<style lang="scss" scoped>
.nc-rail-item {
  @apply flex flex-col gap-1.5 items-center justify-center pt-2.5 pb-1.5 cursor-pointer transition-all duration-150 rounded-[10px];
  width: 53px;
  color: #666;

  :root[theme='dark'] & {
    color: var(--text-muted, #8a8a8a);
  }

  .nc-rail-item-indicator {
    @apply absolute left-0 top-1/2 transform -translate-y-1/2 w-[3px] h-[36px] opacity-0 pointer-events-none;

    border-radius: 0 3px 3px 0;
    background: var(--rail-item-indicator, var(--rail-item-accent, currentColor));
    transition: opacity 0.2s;
  }

  .nc-rail-item-icon {
    @apply h-4 w-4  flex items-center justify-center;
  }

  .nc-rail-item-label {
    @apply select-none text-captionXs text-[9px] font-medium leading-tight tracking-tight opacity-85;
  }

  &:hover:not(.active):not(.disabled) {
    color: #444;
    background: rgba(0, 0, 0, 0.05);

    :root[theme='dark'] & {
      color: var(--text-secondary, #a0a0a0);
      background: rgba(255, 255, 255, 0.05);
    }
  }

  &.active {
    color: var(--rail-item-accent, #1a1a1a);
    background: rgba(0, 0, 0, 0.08);

    :root[theme='dark'] & {
      background: rgba(255, 255, 255, 0.08);
    }

    .nc-rail-item-indicator {
      opacity: 1;
    }

    .nc-rail-item-label {
      opacity: 1;
    }
  }

  &.disabled {
    @apply opacity-40 cursor-not-allowed;
  }
}
</style>
