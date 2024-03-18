<script lang="ts" setup>
const props = defineProps<{
  modelValue?: string
  centered?: boolean
}>()
</script>

<template>
  <a-tabs
    class="nc-tabs"
    :class="{
      centered: props.centered,
    }"
  >
    <slot />
  </a-tabs>
</template>

<style lang="scss">
.nc-tabs.centered {
  > .ant-tabs-nav {
    @apply justify-center mb-0;

    .ant-tabs-nav-wrap {
      @apply w-full flex flex-row justify-center;
    }
  }
}

.ant-tabs-tab + .ant-tabs-tab {
  @apply ml-4;
}

.nc-tabs {
  .ant-tabs-tab {
    @apply px-2 text-gray-600 !hover:text-gray-800;
  }
  .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn {
    @apply text-brand-500;
  }
  .ant-tabs-tab.ant-tabs-tab-active:hover .ant-tabs-tab-btn {
    @apply text-brand-600;
  }

  .ant-tabs-nav {
    @apply pl-2.5 mb-0;
  }

  .ant-tabs-ink-bar {
    @apply bg-brand-500 !rounded-t-xl;
  }
}
</style>
