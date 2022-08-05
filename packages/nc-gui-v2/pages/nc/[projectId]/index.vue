<script setup lang="ts">
import { useProject, useRoute, useSidebar, useTabs, useToggle } from '#imports'
import { TabType } from '~/composables'
import MaterialSymbolsChevronRightRounded from '~icons/material-symbols/chevron-right-rounded'
import MaterialSymbolsChevronLeftRounded from '~icons/material-symbols/chevron-left-rounded'

const route = useRoute()

const { loadProject, loadTables } = useProject(route.params.projectId as string)

const { addTab, clearTabs } = useTabs()

useSidebar({ hasSidebar: true, isOpen: true })

const [isOpen, toggle] = useToggle(true)

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
      :collapsed="!isOpen"
      width="250"
      collapsed-width="0"
      class="relative bg-white dark:!bg-gray-800 border-r-1 border-gray-200 dark:!border-gray-600 h-full"
      :trigger="null"
      collapsible
      theme="light"
    >
      <div
        class="group color-transition cursor-pointer hover:ring active:ring-pink-500 z-1 flex items-center p-[1px] absolute top-9 right-[-0.75rem] shadow bg-gray-100 rounded-full"
      >
        <MaterialSymbolsChevronLeftRounded
          v-if="isOpen"
          class="transform group-hover:(scale-115 text-pink-500) text-xl text-gray-400"
          @click="toggle(false)"
        />

        <MaterialSymbolsChevronRightRounded
          v-else
          class="transform group-hover:(scale-115 text-pink-500) text-xl text-gray-400"
          @click="toggle(true)"
        />
      </div>
      <DashboardTreeView />
    </a-layout-sider>

    <NuxtPage />
  </NuxtLayout>
</template>
