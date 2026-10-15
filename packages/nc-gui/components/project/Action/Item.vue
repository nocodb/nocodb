<script setup lang="ts">
const props = defineProps<{
  disabled?: boolean
  label: string
  /** The shorter label a compact row shows. */
  compactLabel?: string
  subtext?: string
  /** The one-line description a compact row shows. */
  compactSubtext?: string
  /** Marks a compact row reveals on hover: brand logos as-is, or a mono icon with its colour. */
  logos?: (IconMapKey | { icon: IconMapKey; color: string })[]
  isLoading?: boolean
  icon?: IconMapKey
}>()

const isCompact = inject(ProjectActionCompactInj, false)

const displayLogos = computed(() =>
  (props.logos ?? []).map((logo) => (typeof logo === 'string' ? { icon: logo, color: undefined } : logo)),
)

const displayLabel = computed(() => (isCompact ? props.compactLabel ?? props.label : props.label))

const displaySubtext = computed(() => (isCompact ? props.compactSubtext ?? props.subtext : props.subtext))
</script>

<template>
  <div
    role="button"
    class="nc-base-view-all-table-btn"
    :class="{
      disabled,
      'compact': isCompact,
      'loading cursor-wait': isLoading,
      'cursor-pointer': !isLoading,
    }"
  >
    <div class="icon-wrapper">
      <a-skeleton-avatar v-if="isLoading" active shape="square" class="!h-full !w-full !children:(rounded-md w-8 h-8)" />
      <slot v-else name="icon">
        <GeneralIcon v-if="icon" :icon="icon" />
      </slot>
    </div>
    <div class="nc-action-item-text">
      <div class="label">
        <a-skeleton v-if="isLoading" active :title="false" :paragraph="{ rows: 1 }" />

        <slot v-else name="label">
          <NcTooltip :title="displayLabel" show-on-truncate-only class="min-w-0 truncate">
            {{ displayLabel }}
          </NcTooltip>
        </slot>
      </div>
      <div v-if="$slots.subtext || displaySubtext || isLoading" class="subtext">
        <a-skeleton v-if="isLoading" active title :paragraph="false" />
        <slot v-else name="subtext">{{ displaySubtext }}</slot>
      </div>
    </div>
    <div v-if="isCompact && displayLogos.length" class="nc-action-item-logos">
      <div class="nc-action-item-logos-stack">
        <span
          v-for="(logo, logoIdx) in displayLogos"
          :key="logo.icon"
          class="nc-action-item-logo"
          :style="{ zIndex: displayLogos.length - logoIdx, color: logo.color }"
        >
          <GeneralIcon :icon="logo.icon" />
        </span>
      </div>
    </div>
    <div v-if="$slots.srOnly" class="sr-only">
      <slot name="srOnly" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-base-view-all-table-btn {
  @apply flex-none flex flex-col gap-y-3 p-4 bg-nc-bg-card rounded-xl border-1 border-nc-border-gray-light min-w-[230px] max-w-[245px] text-nc-content-gray transition-all duration-300;

  &.disabled {
    @apply bg-nc-bg-card text-nc-content-gray-disabled hover:bg-nc-bg-card cursor-not-allowed;
  }

  &:hover:not(.loading) {
    @apply border-nc-border-gray-medium;
    background-color: var(--nc-bg-card-hover);
    box-shadow: 0px 0px 4px 0px rgba(var(--rgb-base), 0.08);
  }

  .icon-wrapper {
    @apply w-8 h-8 flex items-center;
  }

  .icon-wrapper .nc-icon {
    @apply flex-none h-10 w-10;
  }

  .nc-action-item-text {
    @apply flex flex-col gap-1;
  }

  .label {
    @apply text-base font-bold whitespace-nowrap text-nc-content-gray;
  }

  .subtext {
    @apply text-xs text-nc-content-gray-subtle2;
  }

  // A list row: icon, label and description on one line, provider marks at the end.
  &.compact {
    @apply flex-row items-center gap-3 w-full min-w-0 max-w-none h-10 px-2 py-0 rounded-lg border-transparent bg-transparent;

    --nc-action-chip-surface: var(--nc-bg-default);

    &:hover:not(.loading):not(.disabled) {
      @apply bg-nc-bg-gray-extralight border-transparent;
      box-shadow: none;

      --nc-action-chip-surface: var(--nc-bg-gray-extralight);
    }

    // Keeps each action's own icon colour; only the size is normalised.
    .icon-wrapper {
      @apply w-4 h-4 flex-none;
    }

    // The icon is slotted from each action, so it only matches through :deep.
    .icon-wrapper :deep(.nc-icon) {
      width: 16px !important;
      height: 16px !important;
    }

    .nc-action-item-text {
      @apply flex-row items-baseline gap-2 flex-1 min-w-0;
    }

    .label {
      @apply flex-none text-body text-nc-content-gray-emphasis;
    }

    .subtext {
      @apply min-w-0 truncate text-body text-nc-content-gray-muted;
    }
  }

  :deep(.ant-skeleton-title) {
    @apply !my-0;
  }

  :deep(.ant-skeleton-paragraph) {
    @apply !mb-1;
  }
}

// Chips match the settings rail's provider marks (shell/Rail.vue); revealed on hover.
// The column grows from zero to the stack's width, so the marks slide in from the left.
.nc-action-item-logos {
  @apply grid flex-none;
  grid-template-columns: 0fr;
  opacity: 0;
  transition: opacity 200ms ease, grid-template-columns 200ms ease;
}

.nc-action-item-logos-stack {
  @apply flex items-center min-w-0 overflow-hidden;
}

.nc-action-item-logo {
  @apply relative flex items-center justify-center h-[22px] w-[22px] rounded-full -ml-0.5;
  background: var(--nc-action-chip-surface);
  transition: background-color 200ms ease;

  &:first-child {
    @apply ml-0;
  }

  :deep(svg) {
    @apply !h-4 !w-4 flex-none;
  }

  :deep(svg > rect:first-child) {
    fill: transparent;
  }
}

.nc-base-view-all-table-btn.compact:hover .nc-action-item-logos {
  grid-template-columns: 1fr;
  opacity: 1;
}
</style>
