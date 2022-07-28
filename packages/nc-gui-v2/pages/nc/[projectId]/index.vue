<script setup lang="ts">
import useTabs from '~/composables/useTabs'

const route = useRoute()
const { loadProject, loadTables } = useProject(route.params.projectId as string)
const { clearTabs, addTab } = useTabs()
const { $state } = useNuxtApp()

if (!route.params.type) {
  addTab({ type: 'auth', title: 'Team & Auth' })
}

watch(
  () => route.params.projectId,
  async (newVal, oldVal) => {
    if (newVal !== oldVal) {
      clearTabs()
      if (newVal) {
        await loadProject(newVal as string)
        await loadTables()
      }
    }
  },
)

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
