<script setup lang="ts">
defineProps<{
  disabled?: boolean
  label: string
  subtext?: string
  isLoading?: boolean
}>()
</script>

<template>
  <div
    role="button"
    class="nc-base-view-all-table-btn"
    :class="{
      disabled,
      'loading cursor-wait': isLoading,
      'cursor-pointer': !isLoading,
    }"
  >
    <div class="icon-wrapper">
      <a-skeleton-avatar v-if="isLoading" active shape="square" class="!h-full !w-full !children:(rounded-md w-8 h-8)" />
      <slot v-else name="icon" />
    </div>
    <div class="flex flex-col gap-1">
      <div class="label">
        <a-skeleton v-if="isLoading" active :title="false" :paragraph="{ rows: 1 }" />

        <slot v-else name="label">{{ label }}</slot>
      </div>
      <div v-if="$slots.subtext || subtext || isLoading" class="subtext">
        <a-skeleton v-if="isLoading" active title :paragraph="false" />
        <slot v-else name="subtext">{{ subtext }}</slot>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-base-view-all-table-btn {
  @apply flex-none flex flex-col gap-y-3 p-4 bg-gray-50 rounded-xl border-1 border-gray-100 min-w-[230px] max-w-[245px] text-gray-800  transition-all duration-300;

  &.disabled {
    @apply bg-gray-50 text-gray-400 hover:(bg-gray-50 text-gray-400) cursor-not-allowed;
  }

  &:hover:not(.loading) {
    @apply bg-gray-100 border-gray-200;
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

  :deep(.ant-skeleton-title) {
    @apply !my-0;
  }
  :deep(.ant-skeleton-paragraph) {
    @apply !mb-1;
  }
}
</style>
