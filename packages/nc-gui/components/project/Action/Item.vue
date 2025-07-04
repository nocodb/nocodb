<script setup lang="ts">
defineProps<{
  disabled?: boolean
  label?: string
  subtext?: string
}>()
</script>

<template>
  <div
    role="button"
    class="nc-base-view-all-table-btn"
    :class="{
      disabled: disabled,
    }"
  >
    <div class="icon-wrapper">
      <slot name="icon" />
    </div>
    <div class="flex flex-col gap-1">
      <div class="label">
        <slot name="label">{{ label }}</slot>
      </div>
      <div class="subtext">
        <slot name="subtext">{{ subtext }}</slot>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-base-view-all-table-btn {
  @apply flex-none flex flex-col gap-y-3 p-4 bg-gray-50 rounded-xl border-1 border-gray-100 min-w-[230px] max-w-[245px] cursor-pointer text-gray-800 hover:(bg-gray-100 border-gray-200) transition-all duration-300;

  &.disabled {
    @apply bg-gray-50 text-gray-400 hover:(bg-gray-50 text-gray-400) cursor-not-allowed;
  }

  &:hover {
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
  }

  .icon-wrapper {
    @apply w-8 h-8 flex items-center;
  }

  .nc-icon {
    @apply flex-none h-10 w-10;
  }

  .label {
    @apply text-base font-bold whitespace-nowrap text-gray-800;
  }

  .subtext {
    @apply text-xs text-gray-600;
  }
}
</style>
