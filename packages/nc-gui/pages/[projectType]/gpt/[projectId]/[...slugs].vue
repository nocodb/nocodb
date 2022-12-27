<script setup lang="ts">
import { useProject, useProvideGPTStore, useRoute } from '#imports'

const route = useRoute()

const { loadProject } = useProject()

const { gptLayout } = useProvideGPTStore(route.params.projectId as string)

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
    <template v-if="gptLayout === 'form'" #left> <GptInput /> </template>
    <template v-if="gptLayout === 'form'" #right> <GptOutput /> </template>
    <template v-if="gptLayout === 'grid'" #middle> <GptGrid /> </template>
  </NuxtLayout>
</template>
