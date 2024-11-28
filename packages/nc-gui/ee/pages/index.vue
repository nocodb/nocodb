<script lang="ts" setup>
import { onUnmounted } from '@vue/runtime-core'

definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const router = useRouter()

const route = router.currentRoute

const { ncNavigateTo } = useGlobal()

const workspaceStore = useWorkspace()
const { populateWorkspace } = workspaceStore
const { collaborators, lastPopulatedWorkspaceId, activeWorkspaceId } = storeToRefs(workspaceStore)

const basesStore = useBases()

const tableStore = useTablesStore()

const navigating = ref(false)

const autoNavigateToProject = async ({ initial = false }: { initial: boolean }) => {
  const routeName = route.value.name as string

  if (routeName !== 'index-typeOrId' && routeName !== 'index') {
    return
  }

  if (navigating.value) return

  navigating.value = true

  // open first base if base list is not empty
  if (basesStore.basesList?.length) {
    const firstBase = basesStore.basesList[0]
    if (firstBase && firstBase.id) {
      if (initial) {
        await tableStore.loadProjectTables(firstBase.id)
        const firstTable = tableStore.baseTables.get(firstBase.id)?.[0]

        if (firstTable) {
          ncNavigateTo({
            workspaceId: firstBase.fk_workspace_id!,
            baseId: basesStore.basesList[0].id!,
            tableId: firstTable.id,
          })
        }
      } else {
        await basesStore.navigateToProject({
          workspaceId: firstBase.fk_workspace_id!,
          baseId: basesStore.basesList[0].id!,
        })
      }
    }
  }

  navigating.value = false
}

watch(
  activeWorkspaceId,
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
        await autoNavigateToProject({ initial: oldId === undefined })
      }
    }

    if (lastPopulatedWorkspaceId.value === newId && !route.value.params.typeOrId) {
      await autoNavigateToProject({ initial: false })
    }
  },
  {
    immediate: true,
  },
)

const { deleteWorkspace: _deleteWorkspace, loadWorkspaces } = workspaceStore

// create a new sidebar state
const { toggle, toggleHasSidebar } = useSidebar('nc-left-sidebar', { hasSidebar: true, isOpen: true })

const { sharedBaseId } = useCopySharedBase()

const isDuplicateDlgOpen = ref(false)

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

  if (sharedBaseId.value) isDuplicateDlgOpen.value = true
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
    <DlgSharedBaseDuplicate v-model="isDuplicateDlgOpen" />
  </div>
</template>

<style scoped></style>
