<script lang="ts" setup>
import type { Menu } from 'ant-design-vue'
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

// onMounted(async () => {
//   isLoading.value = true
//   try {
//     await loadWorkspace(route.params.typeOrId as string)
//     await loadProjects()
//   } finally {
//     isLoading.value = false
//   }
// })

// TODO
// const isSharedBase = ref(false)
// const currentVersion = ref('')

const projectId = computed(() => route.value.params.projectId)

const workspaceStore = useWorkspace()
const { populateWorkspace } = workspaceStore
const { collaborators, lastPopulatedWorkspaceId } = storeToRefs(workspaceStore)

const projectsStore = useProjects()

const autoNavigateToProject = async () => {
  const routeName = route.value.name as string

  if (routeName !== 'index-typeOrId' && routeName !== 'index') {
    return
  }

  // open first project if project list is not empty
  if (projectsStore.projectsList?.length)
    await projectsStore.navigateToProject({
      workspaceId: projectsStore.projectsList[0].fk_workspace_id!,
      projectId: projectsStore.projectsList[0].id!,
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
      projectsStore.loadProjects()
      return
    }

    if (newId && oldId !== newId && lastPopulatedWorkspaceId.value !== newId) {
      projectsStore.clearProjects()
      collaborators.value = []
      // return
    }

    if (lastPopulatedWorkspaceId.value !== newId && (newId || workspaceStore.workspacesList.length)) {
      await populateWorkspace()

      if (!route.value.params.projectId && projectsStore.projectsList.length) {
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

  // skip loading workspace and command palette for shared base
  if (!['base'].includes(route.value.params.typeOrId as string)) {
    await loadWorkspaces()
    const { loadScope } = useCommandPalette()
    await loadScope('root')
  }

  if (!workspaceStore?.activeWorkspace?.value && !route.value.params.typeOrId) {
    // if workspace list is empty update loading state and return
    if (!workspaceStore.workspacesList?.length) {
      workspaceStore.setLoadingState(false)
      return
    }

    await populateWorkspace({
      workspaceId: workspaceStore.workspacesList[0].id!,
    })

    if (!route.value.params.projectId && projectsStore.projectsList.length) {
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
      :project-id="dialogProjectId"
    />
  </div>
</template>

<style scoped></style>
