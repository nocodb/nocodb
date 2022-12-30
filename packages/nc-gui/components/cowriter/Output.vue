<script setup lang="ts">
import { useCowriterStoreOrThrow } from '#imports'
const { cowriterOutputList, cowriterOutputActiveKey, clearCowriterOutput } = useCowriterStoreOrThrow()
</script>

<template>
  <a-tabs v-model:activeKey="cowriterOutputActiveKey" class="nc-cowriter-tabs">
    <a-tab-pane key="cowriter-output">
      <template #tab>
        Output
        <span class="bg-gray-200 ml-1 px-2 rounded-md">
          {{ cowriterOutputList.length }}
        </span>
      </template>
      <CowriterList />
    </a-tab-pane>
    <a-tab-pane key="cowriter-history" tab="History">
      <CowriterList />
    </a-tab-pane>
    <template #rightExtra>
      <div class="flex items-center gap-1 px-4">
        <a-button class="!rounded-md" @click="clearCowriterOutput"> Clear </a-button>
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
