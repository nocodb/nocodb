<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import type { WorkspaceType } from 'nocodb-sdk'
import { useWorkspace } from '#imports'
import { navigateTo } from '#app'

const workspaceStore = useWorkspace()

const { activeWorkspace, workspacesList, collaborators } = storeToRefs(workspaceStore)
const { loadWorkspaces } = workspaceStore

const { navigateToTable } = useTablesStore()

const { appInfo, navigateToProject } = useGlobal()

const isWorkspaceDropdownOpen = ref(false)

const createDlg = ref(false)

const otherWorkspaces = computed(() => {
  return workspacesList.value.filter((ws) => ws.id !== activeWorkspace.value?.id)
})

const onWorkspaceCreate = async (workspace: WorkspaceType) => {
  createDlg.value = false
  await loadWorkspaces()

  // TODO: Add to swagger
  const project = (workspace as any).projects?.[0]
  const table = project?.tables?.[0]

  if (project && table) {
    return await navigateToTable({
      projectId: project.id,
      tableId: table.id,
      workspaceId: workspace.id,
    })
  }

  navigateTo(`/${workspace.id}`)
}

const projectStore = useProject()

const { isSharedBase } = storeToRefs(projectStore)

const switchWorkspace = async (workspaceId: string) => {
  navigateToProject({
    workspaceId,
  })
}
</script>

<template>
  <div
    v-if="isSharedBase"
    class="flex flex-row flex-grow pl-0.5 pr-1 py-0.5 rounded-md w-full"
    style="max-width: calc(100% - 2.5rem)"
  >
    <div class="flex-grow min-w-20">
      <div
        data-testid="nc-workspace-menu"
        class="flex items-center nc-workspace-menu overflow-hidden py-1.25 pr-0.25 justify-center w-full"
      >
        <a
          class="w-10 min-w-10 transition-all duration-200 p-1 transform"
          href="https://github.com/nocodb/nocodb"
          target="_blank"
        >
          <img width="25" alt="NocoDB" src="~/assets/img/icons/256x256.png" />
        </a>

        <div class="font-semibold text-base">Nocodb</div>
        <div class="flex flex-grow"></div>
      </div>
    </div>
  </div>
  <div
    v-else
    class="flex flex-row flex-grow hover:bg-gray-200 pl-2 pr-1 py-0.5 rounded-md w-full"
    style="max-width: calc(100% - 2.5rem)"
  >
    <NcDropdown
      v-model:visible="isWorkspaceDropdownOpen"
      class="h-full min-w-0 rounded-lg"
      :trigger="['click']"
      placement="bottom"
      overlay-class-name="nc-dropdown-workspace-menu !overflow-hidden"
    >
      <div
        data-testid="nc-workspace-menu"
        class="group cursor-pointer flex flex-grow w-full gap-x-2 items-center nc-workspace-menu overflow-hidden py-1.25 pr-0.25"
      >
        <GeneralWorkspaceIcon :workspace="activeWorkspace" />
        <div v-if="activeWorkspace" class="flex min-w-10 font-semibold text-base max-w-82/100">
          <div class="text-md truncate capitalize">{{ activeWorkspace.title }}</div>
        </div>

        <GeneralIcon icon="arrowDown" class="min-w-6 text-lg !text-gray-700" />
        <div class="flex flex-grow"></div>
      </div>

      <template #overlay>
        <NcMenu class="nc-workspace-dropdown-inner" style="min-width: calc(110% + 1rem)" @click="isWorkspaceDropdownOpen = false">
          <a-menu-item-group class="!border-t-0">
            <div class="flex gap-x-3 min-w-0 px-4 py-3 items-center">
              <GeneralWorkspaceIcon :workspace="activeWorkspace" size="large" />
              <div class="flex flex-col gap-y-0">
                <div
                  class="mt-0.5 flex capitalize mb-0 nc-workspace-title truncate min-w-10 text-sm text-black font-medium"
                  style="line-height: 1.5rem"
                >
                  {{ activeWorkspace?.title }}
                </div>
                <div class="flex flex-row items-center gap-x-2">
                  <div class="nc-workspace-dropdown-active-workspace-info">Free Plan</div>
                  <div class="nc-workspace-dropdown-active-workspace-info">.</div>
                  <div class="nc-workspace-dropdown-active-workspace-info">
                    {{ collaborators?.length }} {{ Number(collaborators?.length) > 1 ? 'members' : 'member' }}
                  </div>
                </div>
              </div>
            </div>

            <NcDivider />

            <div class="max-h-300px nc-scrollbar-md !overflow-y-auto">
              <a-menu-item v-for="workspace of otherWorkspaces" :key="workspace.id!" @click="switchWorkspace(workspace.id!)">
                <div class="nc-workspace-menu-item group capitalize max-w-300px flex" data-testid="nc-workspace-list">
                  <GeneralWorkspaceIcon :workspace="workspace" hide-label size="small" />
                  <div class="mt-0.5 flex capitalize mb-0 nc-workspace-title truncate min-w-10">
                    {{ workspace?.title }}
                  </div>
                </div>
              </a-menu-item>
            </div>
            <a-menu-item @click="createDlg = true">
              <div class="nc-workspace-menu-item group">
                <GeneralIcon icon="plusSquare" class="!text-inherit" />

                <div class="">Create New Workspace</div>
              </div>
            </a-menu-item>

            <!-- Language -->
            <a-sub-menu
              v-if="!appInfo.ee"
              key="language"
              class="lang-menu !py-0"
              popup-class-name="scrollbar-thin-dull min-w-50 max-h-90vh !overflow-auto"
            >
              <template #title>
                <div class="nc-workspace-menu-item group">
                  <GeneralIcon icon="translate" class="group-hover:text-black nc-language" />
                  {{ $t('labels.language') }}
                  <div class="flex items-center text-gray-400 text-xs">(Community Translated)</div>
                  <div class="flex-1" />

                  <MaterialSymbolsChevronRightRounded
                    class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                  />
                </div>
              </template>

              <template #expandIcon></template>

              <LazyGeneralLanguageMenu />
            </a-sub-menu>
          </a-menu-item-group>
        </NcMenu>
      </template>
    </NcDropdown>
  </div>
  <WorkspaceCreateDlg v-model="createDlg" @success="onWorkspaceCreate" />
</template>

<style scoped lang="scss">
.nc-workspace-menu-item {
  @apply flex items-center pl-1.5 !py-2.5 gap-2 text-sm hover:text-black;
}

.nc-workspace-dropdown-active-workspace-info {
  @apply flex text-xs text-gray-500;
  font-weight: 400;
  line-height: 1.125rem; /* 150% */
  letter-spacing: -0.015rem;
}

:deep(.ant-dropdown-menu-item-group-title) {
  @apply hidden;
}

:deep(.ant-tabs-nav) {
  @apply !mb-0;
}

:deep(.ant-dropdown-menu-submenu-title) {
  @apply !py-0;
  .nc-icon {
    @apply !text-xs;
  }
}

:deep(.ant-menu-item-divider) {
  @apply !border-gray-200;
}
</style>

<style lang="scss">
.ant-dropdown-menu.nc-workspace-dropdown-inner {
  @apply !rounded-lg;
}
</style>
