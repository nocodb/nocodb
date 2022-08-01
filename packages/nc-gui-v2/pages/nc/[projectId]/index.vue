<script setup lang="ts">
import { useTabs } from '#imports'
import { TabType } from '~/composables'

const route = useRoute()
const { loadProject, loadTables } = useProject(route.params.projectId as string)
const { addTab } = useTabs()
const { $state } = useNuxtApp()

if (!route.params.type) {
  addTab({ type: TabType.AUTH, title: 'Team & Auth' })
}

await loadProject(route.params.projectId as string)
await loadTables()

$state.sidebarOpen.value = true
</script>

<template>
  <NuxtLayout>
    <template #sidebar>
      <DashboardTreeView />
    </template>

    <NuxtPage />
  </NuxtLayout>
</template>
