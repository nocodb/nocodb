<script setup lang="ts">
import { useProject, useRoute, useSidebar, useTabs } from '#imports'
import { TabType } from '~/composables'

const route = useRoute()

const { loadProject, loadTables } = useProject(route.params.projectId as string)

const { addTab, clearTabs } = useTabs()

useSidebar({ isOpen: true })

clearTabs()
if (!route.params.type) {
  addTab({ type: TabType.AUTH, title: 'Team & Auth' })
}

await loadProject(route.params.projectId as string)

await loadTables()
</script>

<template>
  <NuxtLayout id="sidebar-right" class="flex">
    <a-layout-sider
      width="250"
      collapsed-width="0"
      class="bg-white dark:!bg-gray-800 border-r-1 border-gray-200 dark:!border-gray-600 h-full"
      :trigger="null"
      collapsible
    >
      <DashboardTreeView />
    </a-layout-sider>

    <NuxtPage />
  </NuxtLayout>
</template>
