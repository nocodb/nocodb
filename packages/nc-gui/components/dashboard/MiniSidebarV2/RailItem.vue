<script lang="ts" setup>
interface Props {
  label?: string
  tooltip?: string
  disableTooltip?: boolean
  icon?: string
  activeIcon?: string
  active?: boolean
  disabled?: boolean
  /** Dropdown trigger — active state shows hover bg only, no indicator or text color */
  isDropdown?: boolean
  /** Hide the left-side active indicator bar and active background */
  plainActive?: boolean
  panelKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  tooltip: '',
  icon: undefined,
  activeIcon: undefined,
  active: false,
  disabled: false,
  isDropdown: false,
  plainActive: false,
  panelKey: undefined,
})

const emits = defineEmits<{
  (e: 'click'): void
}>()

const slots = useSlots()

/** Experiment: rail labels off — icons only, tooltips carry the names. */
const showRailLabels = false

const tooltipText = computed(() => props.tooltip || props.label)

const currentIcon = computed(() => {
  if (props.active && props.activeIcon) return props.activeIcon
  return props.icon
})

const isTooltipDisabled = computed(() => {
  if (!tooltipText.value || props.disableTooltip) return true

  return showRailLabels && !!(props.label || slots.label)
})
</script>

<template>
  <NcTooltip class="w-full flex justify-center relative" placement="right" :arrow="false" :disabled="isTooltipDisabled">
    <template #title>{{ tooltipText }}</template>

    <div
      class="nc-rail-item"
      :class="{ active, disabled, 'is-dropdown': isDropdown, 'plain-active': plainActive }"
      :data-panel="panelKey"
      @click="!disabled && emits('click')"
    >
      <!-- Active indicator bar -->
      <span v-if="!plainActive" class="nc-rail-item-indicator" />

      <span class="nc-rail-item-chip">
        <slot v-if="$slots.default" />

        <template v-else>
          <slot name="icon">
            <GeneralIcon v-if="currentIcon" :icon="(currentIcon as any)" class="nc-rail-item-icon" />
          </slot>
        </template>
      </span>

      <span v-if="showRailLabels && (label || $slots.label)" class="nc-rail-item-label">
        <slot name="label">{{ label }}</slot>
      </span>
    </div>
  </NcTooltip>
</template>

<style lang="scss" scoped>
.nc-rail-item {
  @apply flex flex-col items-center justify-center cursor-pointer transition-all duration-150;
  width: 40px;
  height: auto;

  // The hover/active fill lives on this chip rather than the whole item, so it
  // hugs the icon instead of boxing in the label beneath it.
  .nc-rail-item-chip {
    @apply flex items-center justify-center rounded-lg transition-all duration-150;
    width: 36px;
    height: 26px;
  }

  // Idle state. Kept on a token rather than an rgba literal so every dark
  // palette gets its own value instead of one alpha over twelve grounds.
  &:not(.active) {
    @apply text-nc-content-gray-muted;
  }

  .nc-rail-item-indicator {
    @apply absolute left-0 top-1/2 transform -translate-y-1/2 w-[4px] h-[22px] opacity-0 pointer-events-none rounded-r-[3px];
    @apply bg-nc-content-brand;
    transition: opacity 0.2s;
  }

  .nc-rail-item-icon {
    @apply h-4 w-4 flex items-center justify-center;
  }

  // ncTable is a filled glyph drawn edge-to-edge in its 16px box, while every
  // other rail icon is an outline inset by ~2px — at a matching box it reads
  // oversized, so bring its ink in line with theirs.
  &[data-panel='data'] .nc-rail-item-icon {
    @apply h-[13px] w-[13px];
  }

  .nc-rail-item-label {
    @apply select-none text-captionXsBold leading-tight tracking-tight hidden;
  }

  // One step down from the active label, so the selected item reads as the
  // heavier of the two without the rest shouting.
  &:not(.active) .nc-rail-item-label {
    // font-semibold resolves to 550 here, which is a bigger drop than intended
    font-weight: 600;
  }

  &:hover:not(.active):not(.disabled) .nc-rail-item-chip {
    background: rgba(0, 0, 0, 0.05);

    :root[theme='dark'] & {
      background: rgba(255, 255, 255, 0.05);
    }
  }

  // Normal active state: brand color text + indicator
  &.active:not(.is-dropdown) {
    @apply text-nc-content-brand;

    .nc-rail-item-chip {
      // The palette's selection token, so the tint tracks whichever dark preset
      // is applied rather than sitting as a fixed blue on an arbitrary ground.
      // Pushed toward the brand accent because the raw token is nearly white in
      // light mode; mixing rather than hardcoding keeps all 12 palettes in step.
      background: color-mix(in srgb, var(--nc-content-brand) 15%, var(--color-brand-50));
    }

    // brand-500 on the dark pill is only ~3.5:1 — lift to brand-600 for AA
    :root[theme='dark'] & {
      @apply text-nc-brand-600;
    }

    .nc-rail-item-indicator {
      opacity: 1;
    }
  }

  // Plain active: no background, no indicator — text color preserved from slot content
  &.plain-active.active .nc-rail-item-chip {
    background: transparent;
  }

  // Dropdown active state: hover bg only, no indicator or text color change
  &.is-dropdown.active {
    @apply text-nc-content-gray-muted;

    .nc-rail-item-chip {
      background: rgba(0, 0, 0, 0.05);
    }

    :root[theme='dark'] & .nc-rail-item-chip {
      background: rgba(255, 255, 255, 0.05);
    }
  }

  &.disabled {
    @apply opacity-40 cursor-not-allowed;
  }
}
</style>

<style lang="scss">
.rtl .nc-rail-item .nc-rail-item-indicator {
  left: auto;
  right: 0;
  border-radius: 2px 0 0 2px;
}
</style>
