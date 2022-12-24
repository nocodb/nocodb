<script setup lang="ts">
const activeKey = ref('gpt-form')
</script>

<template>
  <a-tabs v-model:activeKey="activeKey">
    <a-tab-pane key="gpt-form" tab="Fields">
      <GptForm />
    </a-tab-pane>
    <a-tab-pane key="gpt-prompt" tab="Prompt">
      <GptPrompt />
    </a-tab-pane>
    <template #rightExtra>
      <div class="flex items-center gap-1 px-8">
        <a-button class="!rounded-md" type="primary">
          {{ $t('general.generate') }}
        </a-button>
      </div>
    </template>
  </a-tabs>
</template>
