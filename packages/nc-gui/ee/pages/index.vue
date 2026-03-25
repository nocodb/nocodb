<script lang="ts" setup>
definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const router = useRouter()

const route = router.currentRoute

const { ncNavigateTo } = useGlobal()

const { showOnboardingFlow } = useOnboardingFlow()

const workspaceStore = useWorkspace()
const { populateWorkspace } = workspaceStore
const { collaborators, lastPopulatedWorkspaceId, activeWorkspaceId, activeWorkspace, isWorkspacesLoading } =
  storeToRefs(workspaceStore)

const { isDuplicateDlgOpen } = useCopySharedBase()

const { isSharedBase, isSharedErd } = storeToRefs(useBase())

const basesStore = useBases()

const navigating = ref(false)

const wsHomeRouteNames = new Set([
  'index-typeOrId',
  'index-typeOrId-index',
  'index-typeOrId-members',
  'index-typeOrId-teams',
  'index-typeOrId-billing',
  'index-typeOrId-audits',
  'index-typeOrId-sso',
  'index-typeOrId-settings',
  'index-typeOrId-integrations',
])

const isHomeSidebarRoute = computed(() => {
  return wsHomeRouteNames.has(route.value.name as string)
})

const { hideMiniSidebar } = storeToRefs(useSidebarStore())

watch(
  isHomeSidebarRoute,
  (val) => {
    hideMiniSidebar.value = val
  },
  { immediate: true },
)

const autoNavigateToWorkspace = async () => {
  const routeName = route.value.name as string

  // Don't auto-navigate when already on workspace home (/{ws_id})
  if (routeName === 'index-typeOrId' || routeName === 'index-typeOrId-index') {
    return
  }

  if (routeName !== 'index') {
    return
  }

  if (navigating.value) return

  navigating.value = true

  // Navigate to active workspace home page
  const wsId = activeWorkspaceId.value
  if (wsId) {
    await navigateTo(`/${wsId}`)
  }

  navigating.value = false
}

watch(
  [activeWorkspaceId, () => !!activeWorkspace.value, () => showOnboardingFlow.value],
  async ([newId, newWorkspace], [oldId]) => {
    try {
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

      // CE workspace restriction: if URL workspace is locked (non-default in CE mode), redirect to default
      if (newId && !isWorkspacesLoading.value && workspaceStore.isWorkspaceCeLocked(newId)) {
        const defaultWsId = workspaceStore.workspacesList.find((ws) => !workspaceStore.isWorkspaceCeLocked(ws.id))?.id
        if (defaultWsId) {
          await navigateTo(`/${defaultWsId}`)
          return
        }
      }

      if (newId && oldId !== newId && lastPopulatedWorkspaceId.value !== newId) {
        basesStore.clearBases()
        collaborators.value = []
        // return
      }

      // If show onboarding flow is true, don't navigate to workspace
      if (showOnboardingFlow.value) {
        return
      }

      if (newWorkspace && lastPopulatedWorkspaceId.value !== newId && (newId || workspaceStore.workspacesList.length)) {
        await populateWorkspace()

        if (!route.value.params.baseId) {
          await autoNavigateToWorkspace()
        }
      }

      if (lastPopulatedWorkspaceId.value === newId && !route.value.params.typeOrId) {
        await autoNavigateToWorkspace()
      }
    } catch (e: any) {
      console.error(e)
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
  return isSharedViewRoute(route.value)
})

const isSharedFormView = computed(() => {
  return isSharedFormViewRoute(route.value)
})

const { sharedBaseId } = useCopySharedBase()

onMounted(async () => {
  if (isDuplicateDlgOpen.value) {
    isDuplicateDlgOpen.value = false
  }

  if (route.value.meta.public) return

  toggle(true)
  toggleHasSidebar(true)

  // skip loading workspace and command palette for shared source
  if (!['base'].includes(route.value.params.typeOrId as string)) {
    await loadWorkspaces()

    // No workspaces available (e.g. fresh user with NO_ACCESS) — stop skeleton
    if (!workspaceStore.workspacesList.length) {
      workspaceStore.setLoadingState(false)
      basesStore.setProjectsLoaded()
    }
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
    <NuxtLayout v-if="showOnboardingFlow" name="empty">
      <AuthOnboarding />
    </NuxtLayout>

    <NuxtLayout v-else name="dashboard">
      <template #sidebar>
        <DashboardHomeSidebar v-if="isHomeSidebarRoute" />
        <DashboardSidebar v-else />
      </template>
      <template #content>
        <!-- Workspace home: stable header + tabs + dynamic page content -->
        <div v-if="isHomeSidebarRoute" class="flex flex-col h-full">
          <!-- Topbar: workspace name + plan + search -->
          <WorkspaceViewTopbar />
          <!-- Tabs -->
          <WorkspaceViewTabs />
          <!-- Page content (bases, members, teams, etc.) -->
          <div class="flex-1 overflow-auto">
            <NuxtPage :transition="false" />
          </div>
        </div>
        <!-- Non-workspace routes: render page directly -->
        <NuxtPage v-else :transition="false" />
      </template>
    </NuxtLayout>
    <DlgSharedBaseDuplicate v-model="isDuplicateDlgOpen" />
    <DlgWorkspaceSsoRedirectConfirm />
    <DlgOrgSsoRedirectConfirm />
  </div>
</template>

<style scoped></style>
