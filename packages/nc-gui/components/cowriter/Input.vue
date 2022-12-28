<script setup lang="ts">
import { useCowriterStoreOrThrow } from '#imports'
const { generateCowriter } = useCowriterStoreOrThrow()

const activeKey = ref('cowriter-form')

async function generate() {
  await generateCowriter()
}
</script>

<template>
  <a-tabs v-model:activeKey="activeKey" class="nc-cowriter-tabs">
    <a-tab-pane key="cowriter-form" tab="Fields">
      <CowriterForm />
    </a-tab-pane>
    <a-tab-pane key="cowriter-prompt" tab="Prompt">
      <CowriterPrompt />
    </a-tab-pane>
    <template #rightExtra>
      <div class="flex items-center gap-1 px-8">
        <a-button class="!rounded-md" type="primary" @click="generate">
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
