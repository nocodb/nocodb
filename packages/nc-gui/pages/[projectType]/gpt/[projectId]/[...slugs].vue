<script setup lang="ts">
import { useProject, useProvideGPTStore, useRoute } from '#imports'

const route = useRoute()

const { loadProject } = useProject()

useProvideGPTStore(route.params.projectId as string)

loadProject(true, route.params.projectId as string)

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
