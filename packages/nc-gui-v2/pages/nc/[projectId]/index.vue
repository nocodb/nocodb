<script setup lang="ts">
import { provideSidebar, useProject, useRoute, useSidebar, useTabs } from '#imports'
import { TabType } from '~/composables'
import MaterialSymbolsChevronRightRounded from '~icons/material-symbols/chevron-right-rounded'
import MaterialSymbolsChevronLeftRounded from '~icons/material-symbols/chevron-left-rounded'
import MdiChevronDown from '~icons/mdi/chevron-down'

const route = useRoute()

const { project, loadProject, loadTables } = useProject(route.params.projectId as string)

const { addTab, clearTabs } = useTabs()

// set old sidebar state
useSidebar({ isOpen: true })

// create a new sidebar state
const { isOpen, toggle } = provideSidebar({ isOpen: true })

clearTabs()
if (!route.params.type) {
  addTab({ type: TabType.AUTH, title: 'Team & Auth' })
}

await loadProject(route.params.projectId as string)

await loadTables()
</script>

<template>
  <NuxtLayout id="content" class="flex">
    <a-layout-sider
      :collapsed="!isOpen"
      width="250"
      collapsed-width="0"
      class="relative shadow h-full !bg-gray-100/50"
      :trigger="null"
      collapsible
      theme="light"
    >
      <div
        class="group color-transition cursor-pointer hover:ring active:ring-pink-500 z-1 flex items-center absolute top-9 right-[-0.75rem] shadow bg-gray-100 rounded-full"
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

    <teleport v-if="project" to="#header-start">
      <a-dropdown :trigger="['click']">
        <div class="group cursor-pointer w-full flex justify-between items-center">
          <div class="text-xl">{{ project.title }}</div>

          <MdiChevronDown class="group-hover:text-pink-500 text-2xl" />
        </div>

        <template #overlay>
          <div>Foo</div>
        </template>
      </a-dropdown>
    </teleport>

    <NuxtPage />
  </NuxtLayout>
</template>
