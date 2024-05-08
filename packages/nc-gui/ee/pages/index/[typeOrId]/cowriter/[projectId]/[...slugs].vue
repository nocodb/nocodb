<script setup lang="ts">
useSidebar('nc-left-sidebar', { hasSidebar: false })
const route = useRoute()

const { loadProject } = useBase()

const { cowriterLayout } = useProvideCowriterStore(route.params.baseId as string)

loadProject(true, route.params.baseId as string)

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
