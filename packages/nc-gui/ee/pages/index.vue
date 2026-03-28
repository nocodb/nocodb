<script lang="ts" setup>
definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const router = useRouter()

const route = router.currentRoute

const { showOnboardingFlow } = useOnboardingFlow()

const workspaceStore = useWorkspace()
const { populateWorkspace } = workspaceStore
const { collaborators, lastPopulatedWorkspaceId, activeWorkspaceId, activeWorkspace, isWorkspacesLoading, workspacesList } =
  storeToRefs(workspaceStore)

const { isEEFeatureBlocked } = useEeConfig()

const { isDuplicateDlgOpen } = useCopySharedBase()

const { isSharedBase, isSharedErd } = storeToRefs(useBase())

const basesStore = useBases()

const navigating = ref(false)

const isHomeSidebarRoute = computed(() => {
  return isWsHomeRoute(route.value)
})

const { hideMiniSidebar } = storeToRefs(useSidebarStore())

const wsHomeSearchQuery = useState<string>('ws-home-search', () => '')

watch(
  isHomeSidebarRoute,
  (val) => {
    hideMiniSidebar.value = val
    if (val) {
      wsHomeSearchQuery.value = ''
    }
  },
  { immediate: true },
)

const autoNavigateToWorkspace = async () => {
  const routeName = route.value.name as string

  // Don't auto-navigate when already on a workspace page
  if (routeName.startsWith('index-typeOrId')) {
    return
  }

  if (routeName !== 'index') {
    return
  }

  if (navigating.value) return

  navigating.value = true

  const wsId = activeWorkspaceId.value

  // // Lets stay in ws page instead of navigating to first default base for now
  // // Try to navigate into last visited base (backward compat with tests & deep links)
  // if (wsId && basesStore.basesList?.length) {
  //   const lastVisitedBase = ncLastVisitedBase().get()

  //   const firstBase = lastVisitedBase ? basesStore.basesList.find((b) => b.id === lastVisitedBase) : undefined

  //   if (firstBase?.id) {
  //     await basesStore.navigateToProject({
  //       workspaceId: firstBase.fk_workspace_id!,
  //       baseId: firstBase.id!,
  //     })
  //     navigating.value = false
  //     return
  //   }
  // }

  // No bases — navigate to workspace home
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

    // No workspaces available (e.g. fresh user with NO_ACCESS) — stop skeleton and redirect to index
    if (!workspaceStore.workspacesList.length && isEEFeatureBlocked.value) {
      workspaceStore.setLoadingState(false)
      basesStore.setProjectsLoaded()

      if (route.value.params.typeOrId) {
        await router.replace({ name: 'index' })
      }
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
        <!-- Workspace home -->
        <div v-if="isHomeSidebarRoute" class="flex flex-col h-full w-full">
          <!-- Topbar: workspace name + plan + search -->
          <WorkspaceViewTopbar />

          <!-- No workspace access: show empty state -->
          <div
            v-if="!isWorkspacesLoading && !workspacesList.length && isEEFeatureBlocked"
            class="flex-1 flex flex-col items-center justify-center gap-3"
          >
            <GeneralIcon icon="ncWorkspace" class="h-10 w-10 text-nc-content-gray-muted" />
            <h3 class="text-lg font-semibold text-nc-content-gray">
              {{ $t('title.noWorkspaceAccess') }}
            </h3>
            <p class="text-sm text-nc-content-gray-subtle">
              {{ $t('msg.info.contactAdminForAccess') }}
            </p>
          </div>

          <!-- Normal: tabs + page content -->
          <template v-else>
            <WorkspaceViewTabs />
            <div class="flex-1 overflow-auto">
              <NuxtPage :transition="false" />
            </div>
          </template>
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
