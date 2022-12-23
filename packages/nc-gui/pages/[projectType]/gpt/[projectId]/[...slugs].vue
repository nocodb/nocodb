<script setup lang="ts">
definePageMeta({
  key: 'true',
  hideHeader: true,
  layout: 'gpt',
})
</script>

<template>
  <NuxtLayout id="content" class="flex">
    <template #header> <GptHeader /> </template>
    <template #left> <GptInput /> </template>
    <template #right> <GptOutput /> </template>
    <GptPage />
  </NuxtLayout>
</template>
