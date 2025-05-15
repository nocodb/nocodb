<script lang="ts" setup>
const props = defineProps<{
  modelValue?: string
  centered?: boolean
  theme?: 'default' | 'ai'
}>()
</script>

<template>
  <a-tabs
    class="nc-tabs"
    :class="{
      'centered': props.centered,
      'theme-ai': props.theme === 'ai',
    }"
  >
    <slot />

    <template v-if="$slots.leftExtra" #leftExtra>
      <slot name="leftExtra" />
    </template>
    <template v-if="$slots.rightExtra" #rightExtra>
      <slot name="rightExtra" />
    </template>
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

  &.theme-ai {
    .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn {
      @apply text-purple-600;
    }
    .ant-tabs-tab.ant-tabs-tab-active:hover .ant-tabs-tab-btn {
      @apply text-purple-700;
    }
    .ant-tabs-ink-bar {
      @apply bg-purple-500;
    }
  }
}
</style>
