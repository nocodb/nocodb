<script setup lang="ts">
import { provideSidebar, ref, useProject, useRoute, useSidebar, useTabs, useUIPermission } from '#imports'
import { TabType } from '~/composables'

const route = useRoute()

const { project, loadProject, loadTables } = useProject(route.params.projectId as string)

const { addTab, clearTabs } = useTabs()

const { isUIAllowed } = useUIPermission()

// set old sidebar state
useSidebar({ isOpen: true })

// create a new sidebar state
const { isOpen, toggle } = provideSidebar({ isOpen: true })

const dialogOpen = ref(false)

const openDialogKey = ref<string>()

clearTabs()

if (!route.params.type) {
  addTab({ type: TabType.AUTH, title: 'Team & Auth' })
}

function toggleDialog(value?: boolean, key?: string) {
  dialogOpen.value = value ?? !dialogOpen.value
  openDialogKey.value = key
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
      class="relative shadow-md h-full"
      :trigger="null"
      collapsible
      theme="light"
    >
      <a-tooltip placement="right">
        <template #title> Toggle table list </template>

        <div
          :class="[isOpen ? 'right-[-0.75rem]' : 'right-[-1.75rem]']"
          class="group color-transition cursor-pointer hover:ring active:ring-pink-500 z-1 flex items-center absolute top-9 shadow bg-gray-100 rounded-full"
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
      </a-tooltip>
      <DashboardTreeView />
    </a-layout-sider>

    <teleport v-if="project" to="#header-start">
      <a-dropdown :trigger="['click']">
        <div class="group cursor-pointer w-full flex gap-4 items-center">
          <div class="text-xl truncate">{{ project.title }}</div>

          <MdiChevronDown class="min-w-[28.5px] group-hover:text-pink-500 text-2xl" />
        </div>

        <template #overlay>
          <a-menu class="ml-2 !p-0 min-w-32 leading-8 !rounded">
            <a-menu-item-group title="Project Settings">
              <a-menu-item key="copy">
                <div class="nc-project-menu-item group">
                  <MdiContentCopy class="group-hover:text-pink-500" />
                  Copy Project Info
                </div>
              </a-menu-item>

              <a-menu-item key="api">
                <a
                  v-if="isUIAllowed('apiDocs')"
                  v-t="['e:api-docs']"
                  :href="`/api/v1/db/meta/projects/${route.params.projectId}/swagger`"
                  target="_blank"
                  class="nc-project-menu-item group"
                >
                  <MdiApi class="group-hover:text-pink-500" />
                  Swagger: Rest APIs
                </a>
              </a-menu-item>

              <a-menu-item key="teamAndAuth">
                <div
                  v-if="isUIAllowed('settings')"
                  v-t="['c:navdraw:project-settings']"
                  class="nc-project-menu-item group"
                  @click="toggleDialog(true, 'teamAndAuth')"
                >
                  <MdiAccountGroup class="group-hover:text-pink-500" />
                  Team & Auth
                </div>
              </a-menu-item>

              <a-menu-item key="appStore">
                <div
                  v-if="isUIAllowed('settings')"
                  v-t="['c:navdraw:project-settings']"
                  class="nc-project-menu-item group"
                  @click="toggleDialog(true, 'appStore')"
                >
                  <MdiStore class="group-hover:text-pink-500" />
                  App Store
                </div>
              </a-menu-item>

              <a-menu-item key="metaData">
                <div
                  v-if="isUIAllowed('settings')"
                  v-t="['c:navdraw:project-settings']"
                  class="nc-project-menu-item group"
                  @click="toggleDialog(true, 'metaData')"
                >
                  <MdiTableBorder class="group-hover:text-pink-500" />
                  Project Metadata
                </div>
              </a-menu-item>

              <a-menu-item key="audit">
                <div
                  v-if="isUIAllowed('settings')"
                  v-t="['c:navdraw:project-settings']"
                  class="nc-project-menu-item group"
                  @click="toggleDialog(true, 'audit')"
                >
                  <MdiNotebookCheckOutline class="group-hover:text-pink-500" />
                  Audit
                </div>
              </a-menu-item>

              <a-sub-menu key="preview-as">
                <template #title>
                  <div class="nc-project-menu-item group">
                    <MdiContentCopy class="group-hover:text-pink-500" />
                    Preview Project As
                  </div>
                </template>

                <a-menu-item> Foo </a-menu-item>
              </a-sub-menu>
            </a-menu-item-group>
          </a-menu>
        </template>
      </a-dropdown>
    </teleport>

    <dashboard-settings-modal v-model="dialogOpen" :open-key="openDialogKey" />

    <NuxtPage />
  </NuxtLayout>
</template>

<style lang="scss" scoped>
.nc-project-menu-item {
  @apply cursor-pointer flex items-center gap-2 py-3 hover:text-primary after:(content-[''] absolute top-0 left-0 bottom-0 right-0 w-full h-full bg-current opacity-0 transition transition-opactity duration-100) hover:(after:(opacity-5));
}

:deep(.ant-dropdown-menu-item-group-title) {
  @apply border-b-1;
}

:deep(.ant-dropdown-menu-item-group-list) {
  @apply m-0;
}

:deep(.ant-dropdown-menu-item) {
  @apply !py-0 active:(ring ring-pink-500);
}
</style>
