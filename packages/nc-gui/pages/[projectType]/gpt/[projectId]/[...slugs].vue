<script setup lang="ts">
import { useProvideGPTStore, useRoute } from '#imports'

const route = useRoute()

useProvideGPTStore(route.params.projectId as string)

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
  </NuxtLayout>
</template>
