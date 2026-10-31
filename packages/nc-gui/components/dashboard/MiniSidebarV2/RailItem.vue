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
  /** A red dot on the icon: something here needs attention. */
  hasAlert?: boolean
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
  hasAlert: false,
})

const emits = defineEmits<{
  (e: 'click'): void
}>()

// Rail spellings (labels.rail*) carry a zero-width space so long words wrap; keep it out of the tooltip and aria-label.
const plainLabel = computed(() => props.label.replace(/\u200B/g, ''))

const tooltipText = computed(() => props.tooltip || plainLabel.value)

const currentIcon = computed(() => {
  if (props.active && props.activeIcon) return props.activeIcon
  return props.icon
})

// The label already names the item, so only a tooltip that says more is shown.
const isTooltipDisabled = computed(() => {
  if (!tooltipText.value || props.disableTooltip) return true

  return tooltipText.value === plainLabel.value
})

// A real click, so a wrapping dropdown trigger opens too.
function onActivateKey(e: KeyboardEvent) {
  if (props.disabled) return
  ;(e.currentTarget as HTMLElement).click()
}
</script>

<template>
  <NcTooltip class="w-full flex justify-center relative" placement="right" :arrow="false" :disabled="isTooltipDisabled">
    <template #title>{{ tooltipText }}</template>

    <div
      class="nc-rail-item"
      :class="{ active, disabled, 'is-dropdown': isDropdown, 'plain-active': plainActive }"
      :data-panel="panelKey"
      role="button"
      :tabindex="disabled ? -1 : 0"
      :aria-label="tooltipText || undefined"
      :aria-disabled="disabled || undefined"
      @click="!disabled && emits('click')"
      @keydown.enter.prevent="onActivateKey"
      @keydown.space.prevent="onActivateKey"
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

        <span v-if="hasAlert" class="nc-rail-item-alert" />
      </span>

      <span v-if="label || $slots.label" class="nc-rail-item-label">
        <slot name="label">{{ label }}</slot>
      </span>
    </div>
  </NcTooltip>
</template>

<style lang="scss" scoped>
.nc-rail-item {
  @apply flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all duration-150 outline-none;

  &:focus-visible .nc-rail-item-chip {
    @apply shadow-focus;
  }

  width: 40px;
  height: auto;

  // The hover/active fill lives on this chip rather than the whole item, so it
  // hugs the icon instead of boxing in the label beneath it.
  .nc-rail-item-chip {
    @apply relative flex items-center justify-center rounded-lg transition-all duration-150;
    width: 32px;
    height: 32px;
  }

  .nc-rail-item-alert {
    @apply absolute top-[5px] right-[5px] w-1.5 h-1.5 rounded-full pointer-events-none;
    background: var(--nc-content-red-medium);
  }

  // Idle state. Kept on a token rather than an rgba literal so every dark
  // palette gets its own value instead of one alpha over twelve grounds.
  &:not(.active) {
    @apply text-nc-content-gray-muted;
  }

  // Centred on the chip, not the item, whose midpoint the label drags down.
  .nc-rail-item-indicator {
    @apply absolute left-0 top-[16px] transform -translate-y-1/2 w-[4px] h-[22px] opacity-0 pointer-events-none rounded-r-[3px];
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

  // The rail's full 53px content box, not the 40px item, so a bold "Roadmap" (44.3px) stays on
  // one line. Longer words break at their marked break, or the locale's hyphenation, then anywhere.
  .nc-rail-item-label {
    @apply select-none text-captionXsBold leading-tight tracking-tight text-center;
    width: 53px;
    hyphens: auto;
    overflow-wrap: anywhere;
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

  // Touch primary input: the 40x32 target clears WCAG 2.5.8 (AA, 24px) but not
  // 2.5.5 (AAA, 44px) or the Apple/Material minimums, which only matters for
  // fingers. Grow the target, not the icon. The rail stays one width — 54px
  // leaves a 53px content box, so 44 fits without a second rail size.
  @media (pointer: coarse) {
    width: 44px;
    min-height: 44px;

    .nc-rail-item-chip {
      width: 40px;
      height: 40px;
    }

    .nc-rail-item-indicator {
      @apply h-[24px] top-[20px];
    }
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
