<script lang="ts" setup>
import { useGlobal } from '#imports'
import { navigateTo } from '#app'

const router = useRouter()

const route = router.currentRoute

const workspaceStore = useWorkspace()

const { activeWorkspace, isWorkspaceLoading, isWorkspaceOwnerOrCreator } = storeToRefs(workspaceStore)

const projectStore = useProject()

const { isSharedBase } = storeToRefs(projectStore)

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const dialogOpen = ref(false)

const openDialogKey = ref<string>('')

const dataSourcesState = ref<string>('')

const projectId = ref<string>()

function toggleDialog(value?: boolean, key?: string, dsState?: string, pId?: string) {
  dialogOpen.value = value ?? !dialogOpen.value
  openDialogKey.value = key || ''
  dataSourcesState.value = dsState || ''
  projectId.value = pId || ''
}
</script>

<template>
  <div
    class="nc-sidebar flex flex-col bg-gray-50 outline-r-1 outline-gray-100 select-none"
    :style="{
      outlineWidth: '1px',
    }"
  >
    <div class="flex flex-col" style="height: var(--sidebar-top-height)">
      <DashboardSidebarHeader />

      <DashboardSidebarTopSection />
    </div>
    <div class="flex flex-col nc-scrollbar-sm-dark border-t-1 pt-1" style="height: calc(100% - var(--sidebar-top-height))">
      <div class="text-gray-500 mx-4.5 font-medium my-1.5">{{ $t('objects.projects') }}</div>
      <LazyDashboardTreeViewNew
        v-if="!isWorkspaceLoading"
        class="flex-1"
        @create-base-dlg="toggleDialog(true, 'dataSources', null, projectId)"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-sidebar-top-button {
  @apply flex flex-row mx-1 px-3.5 rounded-md items-center py-0.75 my-0.5 gap-x-2 hover:bg-gray-200 cursor-pointer;
}
</style>
