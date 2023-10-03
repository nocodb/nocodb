<script lang="ts" setup>
import { onUnmounted } from '@vue/runtime-core'

definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const router = useRouter()

const route = router.currentRoute

const dialogOpen = ref(false)

const openDialogKey = ref<string>('')

const dataSourcesState = ref<string>('')

const dialogProjectId = ref<string>('')

function toggleDialog(value?: boolean, key?: string, dsState?: string, pId?: string) {
  dialogOpen.value = value ?? !dialogOpen.value
  openDialogKey.value = key || ''
  dataSourcesState.value = dsState || ''
  dialogProjectId.value = pId || ''
}

provide(ToggleDialogInj, toggleDialog)

const workspaceStore = useWorkspace()
const { populateWorkspace } = workspaceStore
const { collaborators, lastPopulatedWorkspaceId } = storeToRefs(workspaceStore)

const basesStore = useBases()

const autoNavigateToProject = async () => {
  const routeName = route.value.name as string

  if (routeName !== 'index-typeOrId' && routeName !== 'index') {
    return
  }

  // open first base if base list is not empty
  if (basesStore.basesList?.length)
    await basesStore.navigateToProject({
      workspaceId: basesStore.basesList[0].fk_workspace_id!,
      baseId: basesStore.basesList[0].id!,
    })
}

watch(
  () => workspaceStore.activeWorkspaceId,
  async (newId, oldId) => {
    if (newId === 'nc') {
      workspaceStore.setLoadingState(false)
      workspaceStore.isWorkspaceLoading = false
      return
    }

    if (newId === 'base') {
      workspaceStore.setLoadingState(false)
      basesStore.loadProjects()
      return
    }

    if (newId && oldId !== newId && lastPopulatedWorkspaceId.value !== newId) {
      basesStore.clearBases()
      collaborators.value = []
      // return
    }

    if (lastPopulatedWorkspaceId.value !== newId && (newId || workspaceStore.workspacesList.length)) {
      await populateWorkspace()

      if (!route.value.params.baseId && basesStore.basesList.length) {
        await autoNavigateToProject()
      }
    }
  },
  {
    immediate: true,
  },
)

const { deleteWorkspace: _deleteWorkspace, loadWorkspaces } = workspaceStore

// create a new sidebar state
const { toggle, toggleHasSidebar } = useSidebar('nc-left-sidebar', { hasSidebar: true, isOpen: true })

let timerRef: any

onUnmounted(() => {
  if (timerRef) clearTimeout(timerRef)
})

onMounted(async () => {
  if (route.value.meta.public) return
  toggle(true)
  toggleHasSidebar(true)

  // skip loading workspace and command palette for shared source
  if (!['base'].includes(route.value.params.typeOrId as string)) {
    await loadWorkspaces()
  }

  if (!workspaceStore?.activeWorkspace?.value && !route.value.params.typeOrId) {
    // if workspace list is empty update loading state and return
    if (!workspaceStore.workspacesList?.length) {
      workspaceStore.setLoadingState(false)
      return
    }

    await populateWorkspace({
      workspaceId: workspaceStore.workspacesList[0].id!,
      force: true,
    })

    if (!route.value.params.baseId && basesStore.basesList.length) {
      await autoNavigateToProject()
    }
  }
})
</script>

<template>
  <div>
    <NuxtLayout name="dashboard">
      <template #sidebar>
        <DashboardSidebar />
      </template>
      <template #content>
        <NuxtPage :transition="false" />
      </template>
    </NuxtLayout>
    <LazyDashboardSettingsModal
      v-model:model-value="dialogOpen"
      v-model:open-key="openDialogKey"
      v-model:data-sources-state="dataSourcesState"
      :base-id="dialogProjectId"
    />
  </div>
</template>

<style scoped></style>
