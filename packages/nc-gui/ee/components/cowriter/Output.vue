<script setup lang="ts">
import { useCowriterStoreOrThrow } from '#imports'
const { COWRITER_TABS, cowriterOutputList, cowriterOutputActiveKey, clearCowriterOutput } = useCowriterStoreOrThrow()
</script>

<template>
  <a-tabs v-model:activeKey="cowriterOutputActiveKey" class="nc-cowriter-tabs">
    <a-tab-pane :key="COWRITER_TABS.OUTPUT_RESULT_KEY">
      <template #tab>
        {{ COWRITER_TABS.OUTPUT_RESULT_VALUE }}
        <span class="bg-gray-200 ml-1 px-2 rounded-md">
          {{ cowriterOutputList.length }}
        </span>
      </template>
      <LazyCowriterList />
    </a-tab-pane>
    <a-tab-pane :key="COWRITER_TABS.OUTPUT_HISTORY_KEY" :tab="COWRITER_TABS.OUTPUT_HISTORY_VALUE">
      <LazyCowriterList />
    </a-tab-pane>
    <a-tab-pane :key="COWRITER_TABS.OUTPUT_STARRED_KEY" :tab="COWRITER_TABS.OUTPUT_STARRED_VALUE">
      <LazyCowriterList />
    </a-tab-pane>
    <template #rightExtra>
      <div class="flex items-center gap-1 px-4">
        <a-tooltip :mouse-enter-delay="0.25" :mouse-leave-delay="0" placement="left">
          <template #title>Clear the recent outputs. They can be still available under History.</template>
          <a-button
            v-if="cowriterOutputActiveKey === COWRITER_TABS.OUTPUT_RESULT_KEY && cowriterOutputList.length > 0"
            class="!rounded-md"
            @click="clearCowriterOutput"
          >
            Clear
          </a-button>
        </a-tooltip>
      </div>
    </template>
  </a-tabs>
</template>

<style scoped lang="scss">
:deep(.ant-tabs-nav) {
  @apply !mb-0;
}

:deep(.ant-tabs-nav-wrap) {
  @apply !ml-[30px];
}
</style>
