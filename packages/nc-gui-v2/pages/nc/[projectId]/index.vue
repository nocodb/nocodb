<script setup lang="ts">
import { navigateTo, onKeyStroke, provideSidebar, ref, useProject, useRoute, useTabs, useUIPermission } from '#imports'
import { TabType } from '~/composables'
import { openLink } from '~/utils'

const route = useRoute()

const { project, loadProject, loadTables } = useProject(route.params.projectId as string)

const { addTab, clearTabs } = useTabs()

const { isUIAllowed } = useUIPermission()

// create a new sidebar state
const { isOpen, toggle } = provideSidebar({ isOpen: true })

const dialogOpen = ref(false)

const openDialogKey = ref<string>()

const dropdownOpen = ref(false)

onKeyStroke(
  'Escape',
  () => {
    dropdownOpen.value = false
  },
  { eventName: 'keydown' },
)

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
    <template #sidebar>
      <a-layout-sider
        :collapsed="!isOpen"
        width="250"
        collapsed-width="50"
        class="relative shadow-md h-full z-1"
        :trigger="null"
        collapsible
        theme="light"
      >
        <div style="height: var(--header-height)" class="flex items-center !bg-primary text-white px-1 pl-6 gap-2">
          <div
            v-if="isOpen"
            class="w-[40px] min-w-[40px] transition-all duration-200 p-1 cursor-pointer transform hover:scale-105"
            @click="navigateTo('/')"
          >
            <img alt="NocoDB" src="~/assets/img/icons/512x512-trans.png" />
          </div>

          <a-dropdown v-model:visible="dropdownOpen" :trigger="['click']">
            <div
              :style="{ width: isOpen ? 'calc(100% - 40px) pr-2' : '100%' }"
              :class="[isOpen ? '' : 'justify-center']"
              class="group cursor-pointer flex gap-4 items-center"
            >
              <template v-if="isOpen">
                <div class="text-xl font-semibold truncate">{{ project.title }}</div>

                <MdiChevronDown class="min-w-[28.5px] group-hover:text-pink-500 text-2xl" />
              </template>

              <template v-else>
                <MdiFolder class="text-primary cursor-pointer transform hover:scale-105 text-2xl" />
              </template>
            </div>

            <template #overlay>
              <a-menu class="ml-6 !w-[300px] !text-sm !p-0 !rounded">
                <a-menu-item-group>
                  <template #title>
                    <div class="group select-none flex items-center gap-4 py-1">
                      <MdiFolder class="group-hover:text-pink-500 text-xl" />

                      <div class="flex flex-col">
                        <div class="text-lg group-hover:(!text-primary) font-semibold truncate">{{ project.title }}</div>

                        <div class="flex items-center gap-1">
                          <div class="group-hover:(!text-primary)">ID:</div>
                          <div class="text-xs group-hover:text-pink-500 truncate font-italic">{{ project.id }}</div>
                        </div>
                      </div>
                    </div>
                  </template>

                  <a-menu-item key="copy">
                    <div class="nc-project-menu-item group">
                      <MdiContentCopy class="group-hover:text-pink-500" />
                      Copy Project Info
                    </div>
                  </a-menu-item>

                  <a-menu-item key="api">
                    <div
                      v-if="isUIAllowed('apiDocs')"
                      v-t="['e:api-docs']"
                      class="nc-project-menu-item group"
                      @click.stop="openLink(`/api/v1/db/meta/projects/${route.params.projectId}/swagger`)"
                    >
                      <MdiApi class="group-hover:text-pink-500" />
                      Swagger: Rest APIs
                    </div>
                  </a-menu-item>

                  <a-menu-divider />

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

                  <a-menu-divider />

                  <a-sub-menu key="preview-as">
                    <template #title>
                      <div class="nc-project-menu-item group">
                        <MdiContentCopy class="group-hover:text-pink-500" />
                        Preview Project As

                        <div class="flex-1" />

                        <MaterialSymbolsChevronRightRounded
                          class="transform group-hover:(scale-115 text-pink-500) text-xl text-gray-400"
                        />
                      </div>
                    </template>

                    <template #expandIcon></template>

                    <GeneralPreviewAs />
                  </a-sub-menu>
                </a-menu-item-group>
              </a-menu>
            </template>
          </a-dropdown>
        </div>

        <a-tooltip placement="right">
          <template #title> Toggle table list </template>

          <div
            class="group color-transition cursor-pointer hover:ring active:ring-pink-500 z-1 flex items-center absolute top-1/2 right-[-0.75rem] shadow bg-gray-100 rounded-full"
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

        <DashboardTreeView v-show="isOpen" />
      </a-layout-sider>
    </template>

    <dashboard-settings-modal v-model="dialogOpen" :open-key="openDialogKey" />

    <NuxtPage />

    <GeneralPreviewAs float />
  </NuxtLayout>
</template>

<style lang="scss" scoped>
.nc-project-menu-item {
  @apply cursor-pointer flex items-center gap-2 py-2 hover:text-primary after:(content-[''] absolute top-0 left-0 bottom-0 right-0 w-full h-full bg-current opacity-0 transition transition-opactity duration-100) hover:(after:(opacity-5));
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
