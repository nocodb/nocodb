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
  </a-tabs>
</template>
