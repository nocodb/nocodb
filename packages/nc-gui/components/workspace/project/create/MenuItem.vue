<script lang="ts" setup>
import { NcMenuItem } from '#components'

interface Props {
  label: string
  subtext?: string
  icon?: IconMapKey
  variant?: 'dropdown' | 'modal' | 'card'
  /** `card` only — the tint of the border, panel and hover shadow. */
  tone?: 'brand' | 'purple' | 'orange' | 'pink' | 'gray'
}

withDefaults(defineProps<Props>(), { tone: 'gray' })

/** Enter on a focused card is a click — the listener the parent attached is on the root. */
function onEnter(event: KeyboardEvent) {
  ;(event.currentTarget as HTMLElement | null)?.click()
}
</script>

<template>
  <!-- Same metrics as the kind cards in `create/Kind.vue`. -->
  <div
    v-if="variant === 'card'"
    class="nc-create-project-card"
    :class="`nc-create-project-card-${tone}`"
    role="button"
    tabindex="0"
    @keydown.enter="onEnter"
  >
    <div class="nc-placeholder-icon-wrapper">
      <slot name="illustration">
        <GeneralIcon v-if="icon" :icon="icon" class="flex-none !h-20 !w-20" />
      </slot>
    </div>

    <div class="px-4 py-3 flex flex-col gap-2">
      <div class="flex items-center gap-2 text-subHeading2 text-nc-content-gray">
        <GeneralIcon v-if="icon" :icon="icon" class="h-4 w-4 flex-none nc-create-project-card-icon" />
        <slot name="label">{{ label }}</slot>
      </div>
      <div v-if="$slots.subtext || subtext" class="text-bodyDefaultSm text-nc-content-gray-muted">
        <slot name="subtext">{{ subtext }}</slot>
      </div>
    </div>
  </div>

  <component
    :is="variant === 'modal' ? 'div' : NcMenuItem"
    v-else
    :inner-class="`w-full ${$slots.subtext || subtext ? '!items-start' : ''}`"
    :class="`nc-create-project-menu-item-${variant}`"
  >
    <div class="nc-icon-wrapper">
      <slot name="icon">
        <GeneralIcon v-if="icon" :icon="icon" class="h-4 w-4 flex-none" />
      </slot>
    </div>

    <div class="nc-content-wrapper">
      <div class="nc-content-label">
        <slot name="label">{{ label }}</slot>
      </div>
      <div v-if="$slots.subtext || subtext" class="nc-content-subtext">
        <slot name="subtext">{{ subtext }}</slot>
      </div>
    </div>
  </component>
</template>

<style lang="scss" scoped>
.nc-icon-wrapper {
  @apply flex items-center justify-center h-5 children:flex-none;
}

.nc-create-project-menu-item-modal {
  @apply font-normal text-sm flex items-start gap-3 mx-1 px-2 py-1 rounded-md hover:bg-nc-bg-gray-light transition-colors cursor-pointer;

  .nc-content-wrapper {
    .nc-content-label {
    }
  }
}

.nc-content-wrapper {
  .nc-content-subtext {
    @apply text-tiny !leading-4 text-nc-content-gray-muted;
  }
}

.nc-create-project-card {
  @apply rounded-xl flex flex-col border-1 w-[288px] overflow-hidden cursor-pointer transition-all;

  &:focus-visible {
    @apply shadow-focus outline-none;
  }

  .nc-placeholder-icon-wrapper {
    @apply border-b-1 h-[180px] flex items-center justify-center;
  }

  &.nc-create-project-card-brand {
    @apply border-nc-border-brand-medium;

    &:hover {
      box-shadow: 0px 12px 16px -4px rgba(51, 102, 255, 0.12), 0px 4px 6px -2px rgba(51, 102, 255, 0.08);
    }

    .nc-placeholder-icon-wrapper {
      @apply border-nc-border-brand-medium bg-nc-bg-brand;
    }

    .nc-create-project-card-icon {
      @apply text-nc-content-gray-subtle;
    }
  }

  &.nc-create-project-card-purple {
    @apply border-nc-border-purple-medium;

    &:hover {
      box-shadow: 0px 12px 16px -4px rgba(125, 38, 205, 0.12), 0px 4px 6px -2px rgba(125, 38, 205, 0.08);
    }

    .nc-placeholder-icon-wrapper {
      @apply border-nc-border-purple-medium bg-nc-bg-purple-light text-nc-fill-purple-dark;
    }

    .nc-create-project-card-icon {
      @apply text-nc-fill-purple-dark;
    }
  }

  &.nc-create-project-card-orange {
    @apply border-nc-orange-200;

    &:hover {
      box-shadow: 0px 12px 16px -4px rgba(250, 130, 49, 0.12), 0px 4px 6px -2px rgba(250, 130, 49, 0.08);
    }

    .nc-placeholder-icon-wrapper {
      @apply border-nc-orange-200 bg-nc-orange-50 text-nc-content-orange-dark;
    }

    .nc-create-project-card-icon {
      @apply text-nc-content-orange-dark;
    }
  }

  &.nc-create-project-card-pink {
    @apply border-nc-pink-200;

    &:hover {
      box-shadow: 0px 12px 16px -4px rgba(252, 58, 198, 0.12), 0px 4px 6px -2px rgba(252, 58, 198, 0.08);
    }

    .nc-placeholder-icon-wrapper {
      @apply border-nc-pink-200 bg-nc-pink-50 text-nc-content-pink-dark;
    }

    .nc-create-project-card-icon {
      @apply text-nc-content-pink-dark;
    }
  }

  &.nc-create-project-card-gray {
    @apply border-nc-border-gray-medium;

    &:hover {
      box-shadow: 0px 12px 16px -4px rgba(107, 114, 128, 0.12), 0px 4px 6px -2px rgba(107, 114, 128, 0.08);
    }

    .nc-placeholder-icon-wrapper {
      @apply border-nc-border-gray-medium bg-nc-bg-gray-light text-nc-content-gray-subtle;
    }

    .nc-create-project-card-icon {
      @apply text-nc-content-gray-subtle;
    }
  }
}
</style>
