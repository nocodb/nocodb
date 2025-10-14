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
  @apply flex-none flex flex-col gap-y-3 p-4 bg-nc-bg-gray-extralight rounded-xl border-1 border-nc-border-gray-light min-w-[230px] max-w-[245px] text-nc-content-gray transition-all duration-300;

  &.disabled {
    @apply bg-nc-bg-gray-extralight text-nc-content-gray-disabled hover:bg-nc-bg-gray-extralight cursor-not-allowed;
  }

  &:hover:not(.loading) {
    @apply bg-nc-bg-gray-light border-nc-border-gray-medium;
    box-shadow: 0px 0px 4px 0px rgba(var(--rgb-base), 0.08);
  }

  .icon-wrapper {
    @apply w-8 h-8 flex items-center;
  }

  .nc-icon {
    @apply flex-none h-10 w-10;
  }

  .label {
    @apply text-base font-bold whitespace-nowrap text-nc-content-gray;
  }

  .subtext {
    @apply text-xs text-nc-content-gray-subtle2;
  }

  :deep(.ant-skeleton-title) {
    @apply !my-0;
  }
  :deep(.ant-skeleton-paragraph) {
    @apply !mb-1;
  }
}
</style>
