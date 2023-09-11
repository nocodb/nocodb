<script lang="ts" setup>
import type { WorkspaceType } from 'nocodb-sdk'

const workspaceStore = useWorkspace()

const { activeWorkspace, workspacesList, collaborators } = storeToRefs(workspaceStore)
const { loadWorkspaces } = workspaceStore

const { leftSidebarState, viewportWidth, leftSidebarWidthPercent } = storeToRefs(useSidebarStore())

const { navigateToTable } = useTablesStore()

const { navigateToProject } = useGlobal()

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

watch(leftSidebarState, () => {
  if (leftSidebarState.value === 'peekCloseEnd') {
    isWorkspaceDropdownOpen.value = false
  }
})

// TODO: Improve this
// As ant-dropdown only sets min width, so to have dropdown content same as dropdown trigger button
// We need to manually calculate width of dropdown content, as otherwise ant-dropdown will be width of content
const sidebarWidthRem = computed(() => {
  const pxInRem = parseFloat(getComputedStyle(document.documentElement).fontSize)

  return (viewportWidth.value * leftSidebarWidthPercent.value) / 100 / pxInRem
})
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
    class="flex flex-row flex-grow w-full max-w-85/100 hover:bg-gray-200 pl-2 pr-1 py-0.5 rounded-md"
    :style="{
      maxWidth: `calc(100% - 2.5rem)`,
    }"
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
        <div v-if="activeWorkspace" class="flex min-w-10 w-full">
          <div class="font-semibold text-base text-md truncate capitalize">
            {{ activeWorkspace.title }}
          </div>
        </div>

        <GeneralIcon icon="arrowDown" class="min-w-6 text-lg !text-gray-700" />
      </div>

      <template #overlay>
        <NcMenu
          :style="{
            width: `${sidebarWidthRem - 3.5}rem`,
          }"
          @click="isWorkspaceDropdownOpen = false"
        >
          <a-menu-item-group>
            <div class="flex min-w-0">
              <div class="flex gap-x-3 w-full px-4 py-3 items-center">
                <GeneralWorkspaceIcon :workspace="activeWorkspace" size="large" />
                <div class="flex flex-col gap-y-0" style="width: calc(100% - 3.25rem)">
                  <div class="mt-0.5 flex capitalize mb-0 nc-workspace-title w-full">
                    <div class="min-w-10 text-sm text-black font-medium truncate capitalize" style="line-height: 1.5rem">
                      {{ activeWorkspace?.title }}
                    </div>
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
            </div>

            <NcDivider class="!mb-0" />

            <div class="max-h-300px nc-scrollbar-md !overflow-y-auto py-1">
              <NcMenuItem v-for="workspace of otherWorkspaces" :key="workspace.id!" @click="switchWorkspace(workspace.id!)">
                <div class="nc-workspace-menu-item group capitalize max-w-300px flex" data-testid="nc-workspace-list">
                  <GeneralWorkspaceIcon :workspace="workspace" hide-label size="small" />
                  <div class="mt-0.5 flex capitalize mb-0 nc-workspace-title truncate min-w-10">
                    {{ workspace?.title }}
                  </div>
                </div>
              </NcMenuItem>
            </div>
            <NcDivider v-if="otherWorkspaces.length" class="!mt-0" />
            <NcMenuItem @click="createDlg = true">
              <div class="nc-workspace-menu-item group">
                <GeneralIcon icon="plusSquare" class="!text-inherit" />

                <div class="">Create New Workspace</div>
              </div>
            </NcMenuItem>
          </a-menu-item-group>
        </NcMenu>
      </template>
    </NcDropdown>
  </div>
  <WorkspaceCreateDlg v-model="createDlg" @success="onWorkspaceCreate" />
</template>

<style scoped lang="scss">
.nc-workspace-menu-item {
  @apply flex items-center !py-0 !pl-1 gap-2 text-sm hover:text-black;
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
</style>
