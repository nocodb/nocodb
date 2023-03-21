<script lang="ts" setup>
import { onMounted, storeToRefs, useRouter, useWorkspace } from '#imports'
import { useProject } from '~/store/project'

definePageMeta({
  hideHeader: true,
})

const router = useRouter()
const route = $(router.currentRoute)

const { project } = storeToRefs(useProject())

const workspaceStore = useWorkspace()

const { workspace } = storeToRefs(workspaceStore)

const dialogOpen = ref(false)

const openDialogKey = ref<string>('')

const dataSourcesState = ref<string>('')

function toggleDialog(value?: boolean, key?: string, dsState?: string) {
  dialogOpen.value = value ?? !dialogOpen.value
  openDialogKey.value = key || ''
  dataSourcesState.value = dsState || ''
}

provide(ToggleDialogInj, toggleDialog)


onMounted(async () => {
  await workspaceStore.loadWorkspace(route.params.workspaceId as string)
  await workspaceStore.loadProjects()
})

// todo:
const isOpen = ref(true)
const isSharedBase = ref(false)
const currentVersion = ref('')
</script>

<template>
  <NuxtLayout>
    <!--    Workspace -->

    <!--    {{ workspaceStore.workspace }} -->
    <!--    {{ workspaceStore.projects }} -->

    <!--    <nuxt-page/> -->
    <template #sidebar>
      <a-layout-sider
        ref="sidebar"
        :collapsed="!isOpen"
        width="250"
        collapsed-width="50"
        class="relative shadow-md h-full z-1 nc-left-sidebar"
        :trigger="null"
        collapsible
        theme="light"
      >
        <div
          style="height: var(--header-height); border-bottom-width: 1px"
          :class="isOpen ? 'pl-4' : ''"
          class="flex items-center px-1 gap-1 nc-sidebar-header"
        >
          <div
            v-if="isOpen && !isSharedBase"
            v-e="['c:navbar:home']"
            data-testid="nc-noco-brand-icon"
            class="w-[29px] min-w-[29px] transition-all duration-200 py-1 pl-1 cursor-pointer transform hover:scale-105 nc-noco-brand-icon"
            @click="navigateTo('/')"
          >
            <a-tooltip placement="bottom">
              <template #title>
                {{ currentVersion }}
              </template>
              <img width="25" class="-mr-1" alt="NocoDB" src="~/assets/img/icons/512x512.png" />
            </a-tooltip>
          </div>

          <a
            v-if="isOpen && isSharedBase"
            class="w-[40px] min-w-[40px] transition-all duration-200 p-1 cursor-pointer transform hover:scale-105"
            href="https://github.com/nocodb/nocodb"
            target="_blank"
          >
            <a-tooltip placement="bottom">
              <template #title>
                {{ currentVersion }}
              </template>
              <img width="25" alt="NocoDB" src="~/assets/img/icons/512x512-trans.png" />
            </a-tooltip>
          </a>

          <WorkspaceMenu :workspace="workspace" :is-open="isOpen" />
          <div
            class="nc-sidebar-left-toggle-icon hover:after:(bg-primary bg-opacity-75) group nc-sidebar-add-row flex items-center px-2"
          >
            <PhCaretDoubleLeftThin
              v-e="['c:grid:toggle-navdraw']"
              class="cursor-pointer transform transition-transform duration-500"
              :class="{ 'rotate-180': !isOpen }"
              @click="toggle(!isOpen)"
            />
          </div>
        </div>

        <LazyDashboardTreeViewNew @create-base-dlg="toggleDialog(true, 'dataSources')" />
      </a-layout-sider>
    </template>

    <NuxtPage />

    <LazyDashboardSettingsModal
        v-model:model-value="dialogOpen"
        v-model:open-key="openDialogKey"
        v-model:data-sources-state="dataSourcesState"
    />
  </NuxtLayout>
</template>

<style scoped></style>
