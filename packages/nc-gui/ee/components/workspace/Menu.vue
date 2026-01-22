<script lang="ts" setup>
import { type WorkspaceType } from 'nocodb-sdk'

const isMiniSidebar = inject(IsMiniSidebarInj, undefined)

const workspaceStore = useWorkspace()

const { activeWorkspace, workspacesList } = storeToRefs(workspaceStore)
const { loadWorkspaces } = workspaceStore

const { isDark } = useTheme()

const { navigateToTable } = useTablesStore()

const { $e } = useNuxtApp()

const isBaseListModalOpen = ref(false)

const createDlg = ref(false)

const onWorkspaceCreate = async (workspace: WorkspaceType) => {
  createDlg.value = false
  await loadWorkspaces()

  // TODO: Add to swagger
  const base = (workspace as any).bases?.[0]
  const table = base?.tables?.[0]

  if (base && table) {
    return await navigateToTable({
      baseId: base.id,
      tableId: table.id,
      workspaceId: workspace.id,
    })
  }

  navigateTo(`/${workspace.id}`)
}

const baseStore = useBase()

const { isSharedBase } = storeToRefs(baseStore)
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
          class="w-24 min-w-10 transition-all duration-200 p-1 transform"
          href="https://github.com/nocodb/nocodb"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img v-if="isDark" alt="NocoDB" src="~/assets/img/brand/text.png" />
          <img v-else alt="NocoDB" src="~/assets/img/brand/nocodb.png" />
        </a>

        <div class="flex flex-grow"></div>
      </div>
    </div>
  </div>
  <div
    v-else-if="activeWorkspace"
    :class="{
      'flex flex-row flex-grow w-full max-w-85/100 hover:bg-nc-bg-gray-medium pl-2 pr-1 py-0.5 rounded-md': !isMiniSidebar,
      'nc-mini-sidebar-btn-full-width flex items-center justify-center children:(h-auto w-full)': isMiniSidebar,
    }"
    :style="{
      maxWidth: !isMiniSidebar ? `calc(100% - 2.5rem)` : undefined,
    }"
  >
    <div
      v-e="['c:workspace:menu']"
      :class="{
        'flex items-center justify-center': isMiniSidebar,
        'flex': !isMiniSidebar,
      }"
      @click="isBaseListModalOpen = true"
    >
      <div
        data-testid="nc-workspace-menu"
        :class="{
          'nc-mini-sidebar-ws-item': isMiniSidebar,
          'group cursor-pointer flex flex-grow w-full gap-x-2 items-center overflow-hidden py-1.25 xs:py-1.75 pr-0.25':
            !isMiniSidebar,
          'nc-small-shadow': workspacesList.length === 2,
          'nc-medium-shadow': workspacesList.length > 2,
        }"
        class="nc-workspace-menu"
      >
        <GeneralWorkspaceIcon
          :workspace="activeWorkspace"
          show-nocodb-icon
          class="flex-none border-1 border-nc-border-gray-medium"
          :size="isMiniSidebar ? 'mini-sidebar' : 'medium'"
        />
        <div v-if="activeWorkspace && !isMiniSidebar" class="flex min-w-10 w-full items-center">
          <div class="nc-workspace-title font-semibold text-base text-md truncate capitalize">
            {{ activeWorkspace.title }}
          </div>
          <GeneralIcon icon="chevronDown" class="mt-0.5 ml-1 min-w-6 text-lg !text-nc-gray-500/75" />
        </div>
      </div>
    </div>
  </div>
  <WorkspaceCreateDlg v-model="createDlg" @success="onWorkspaceCreate" />
  <WorkspaceBaseListModal v-model:visible="isBaseListModalOpen" />
</template>

<style scoped lang="scss">
.nc-workspace-menu {
  @apply cursor-pointer;
}
</style>
