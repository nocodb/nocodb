<script lang="ts" setup>
import { NcMenuItem } from '#components'

interface Props {
  label: string
  subtext?: string
  icon?: IconMapKey
  variant?: 'dropdown' | 'modal'
}

withDefaults(defineProps<Props>(), {})
</script>

<template>
  <component
    :is="variant === 'modal' ? 'div' : NcMenuItem"
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
</style>
