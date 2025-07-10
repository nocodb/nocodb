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
const { collaborators, lastPopulatedWorkspaceId, activeWorkspaceId, activeWorkspace, isWorkspacesLoading } =
  storeToRefs(workspaceStore)

const { isSharedBase, isSharedErd } = storeToRefs(useBase())

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
    const lastVisitedBase = ncLastVisitedBase().get()

    const firstBase = lastVisitedBase
      ? basesStore.basesList.find((b) => b.id === lastVisitedBase) ?? basesStore.basesList[0]
      : basesStore.basesList[0]

    if (firstBase && firstBase.id) {
      if (initial) {
        await tableStore.loadProjectTables(firstBase.id)
        const firstTable = tableStore.baseTables.get(firstBase.id)?.[0]
        const query = route.value.query

        if (firstTable) {
          ncNavigateTo({
            workspaceId: firstBase.fk_workspace_id!,
            baseId: firstBase.id!,
            tableId: firstTable.id,
            query,
          })
        }
      } else {
        await basesStore.navigateToProject({
          workspaceId: firstBase.fk_workspace_id!,
          baseId: firstBase.id!,
        })
      }
    }
  }

  navigating.value = false
}

watch(
  [activeWorkspaceId, () => !!activeWorkspace.value],
  async ([newId, newWorkspace], [oldId]) => {
    if (newId === 'nc') {
      workspaceStore.setLoadingState(false)
      isWorkspacesLoading.value = false

      return
    }

    if (newId === 'base') {
      workspaceStore.setLoadingState(false)
      isWorkspacesLoading.value = false

      basesStore.loadProjects()
      return
    }

    if (newId && oldId !== newId && lastPopulatedWorkspaceId.value !== newId) {
      basesStore.clearBases()
      collaborators.value = []
      // return
    }

    if (newWorkspace && lastPopulatedWorkspaceId.value !== newId && (newId || workspaceStore.workspacesList.length)) {
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

const isSharedView = computed(() => {
  const routeName = (route.value.name as string) || ''

  // check route is not base page by route name
  return (
    !routeName.startsWith('index-typeOrId-baseId-') &&
    !['index', 'index-typeOrId', 'index-typeOrId-feed', 'index-typeOrId-integrations'].includes(routeName)
  )
})

const isSharedFormView = computed(() => {
  const routeName = (route.value.name as string) || ''
  // check route is shared form view route
  return routeName.startsWith('index-typeOrId-form-viewId')
})

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

watch(
  [() => isSharedFormView.value, () => isSharedView.value, () => isSharedBase.value, () => isSharedErd.value],
  (arr) => {
    addConfirmPageLeavingRedirectToWindow(!arr.some(Boolean))
  },
  {
    immediate: true,
  },
)
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
    <DlgWorkspaceSsoRedirectConfirm />
  </div>
</template>

<style scoped></style>
