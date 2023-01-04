<script setup lang="ts">
import { useCowriterStoreOrThrow } from '#imports'
const { cowriterInputActiveKey, generateCowriter, generateCowriterLoading, maxCowriterGeneration } = useCowriterStoreOrThrow()

async function generate() {
  await generateCowriter()
}
</script>

<template>
  <a-tabs v-model:activeKey="cowriterInputActiveKey" class="nc-cowriter-tabs">
    <a-tab-pane key="cowriter-form" tab="Fields">
      <LazyCowriterForm />
    </a-tab-pane>
    <a-tab-pane key="cowriter-prompt" tab="Prompt">
      <LazyCowriterPrompt />
    </a-tab-pane>
    <template #rightExtra>
      <div class="flex items-center gap-1 px-8">
        <a-input-number v-model:value="maxCowriterGeneration" type="number" :min="1" :max="10" />
        <a-button class="!rounded-md" type="primary" :loading="generateCowriterLoading" @click="generate">
          {{ $t('general.generate') }}
        </a-button>
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
