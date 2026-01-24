<script lang="ts" setup>
interface Props {
  label?: string
  subtext?: string
  icon?: IconMapKey
  iconWrapperClass?: string
  clickable?: boolean
}

withDefaults(defineProps<Props>(), {})
</script>

<template>
  <div :tabindex="clickable ? 0 : undefined" class="nc-managed-app-status-menu-item" :class="{ 'nc-clickable': clickable }">
    <div class="nc-icon-wrapper" :class="iconWrapperClass">
      <slot name="icon">
        <GeneralIcon v-if="icon" :icon="icon" class="h-4 w-4 flex-none" />
      </slot>
    </div>

    <div class="nc-content-wrapper flex-1">
      <div v-if="$slots.label || label" class="nc-content-label">
        <slot name="label">{{ label }}</slot>
      </div>
      <div v-if="$slots.subtext || subtext" class="nc-content-subtext">
        <slot name="subtext">{{ subtext }}</slot>
      </div>
    </div>
    <slot name="extraRight"> </slot>
  </div>
</template>

<style lang="scss" scoped>
.nc-managed-app-status-menu-item {
  @apply flex items-center gap-3 p-2  my-0.5 mx-1 rounded-lg transition-colors;

  &.nc-clickable {
    @apply cursor-pointer select-none hover:bg-nc-bg-gray-extralight;
  }
}
.nc-icon-wrapper {
  @apply w-8 h-8 rounded-lg flex items-center justify-center children:flex-none;
}

.nc-content-label {
  @apply text-caption font-600 text-nc-content-gray-subtle2;
}

.nc-content-subtext {
  @apply text-captionSm text-nc-content-gray-muted mt-0.25;
}
</style>
