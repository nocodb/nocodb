<script setup lang="ts">
import { useProject, useProvideCowriterStore, useRoute } from '#imports'

useSidebar('nc-left-sidebar', { hasSidebar: true })
const route = useRoute()

const { loadProject } = useProject()

const { cowriterLayout } = useProvideCowriterStore(route.params.projectId as string)

loadProject(true, route.params.projectId as string)

definePageMeta({
  key: 'true',
  hideHeader: true,
  layout: 'cowriter',
})
</script>

<template>
  <NuxtLayout id="content" class="flex">
    <template #header> <CowriterHeader /> </template>
    <template v-if="cowriterLayout === 'form'" #left> <CowriterInput /> </template>
    <template v-if="cowriterLayout === 'form'" #right> <CowriterOutput /> </template>
    <template v-if="cowriterLayout === 'grid'" #middle> <CowriterGrid /> </template>
  </NuxtLayout>
</template>
