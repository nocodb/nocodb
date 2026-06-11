<script lang="ts" setup>
definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const { showOnboardingFlow } = useOnboardingFlow()

const { isSharedBase, isSharedErd } = storeToRefs(useBase())

const basesStore = useBases()

const workspaceStore = useWorkspace()

const { populateWorkspace } = workspaceStore

const { activeWorkspaceId } = storeToRefs(workspaceStore)

const { signedIn } = useGlobal()

const { isUIAllowed } = useRoles()

const router = useRouter()

const route = router.currentRoute

const { basesList } = storeToRefs(basesStore)

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

  const wsId = activeWorkspaceId.value

  // Try to navigate into last visited base (backward compat)
  if (wsId && basesList.value?.length) {
    const lastVisitedBase = ncLastVisitedBase().get()

    const firstBase = lastVisitedBase ? basesList.value.find((b) => b.id === lastVisitedBase) : undefined

    if (firstBase?.id) {
      await basesStore.navigateToProject({ baseId: firstBase.id! })
      return
    }
  }

  // No bases — navigate to workspace home
  if (wsId) {
    await navigateTo(`/${wsId}`)
  }
}

const isSharedView = computed(() => {
  return isSharedViewRoute(route.value)
})

const isSharedFormView = computed(() => {
  return isSharedFormViewRoute(route.value)
})

const { sharedBaseId } = useCopySharedBase()

const isDuplicateDlgOpen = ref(false)

async function handleRouteTypeIdChange() {
  // Avoid loading bases if onboarding flow is shown
  if (showOnboardingFlow.value) {
    return
  }

  // avoid loading bases for shared views
  if (isSharedView.value) {
    return
  }

  try {
    // avoid loading bases for shared base
    if (route.value.params.typeOrId === 'base') {
      await populateWorkspace()
      return
    }

    if (!signedIn.value) {
      navigateTo('/signIn')
      return
    }

    // Load bases
    await populateWorkspace()

    if (!route.value.params.baseId) {
      await autoNavigateToWorkspace()
    }
  } catch (e: any) {
    console.error(e)
  }
}

watch([() => route.value.params.typeOrId, () => showOnboardingFlow.value], () => {
  handleRouteTypeIdChange()
})

// onMounted is needed instead having this function called through
// immediate watch, because if route is changed during page transition
// It will error out nuxt
onMounted(() => {
  handleRouteTypeIdChange().then(() => {
    if (sharedBaseId.value) {
      if (!isUIAllowed('baseDuplicate')) {
        message.error('You are not allowed to create base')
        return
      }
      isDuplicateDlgOpen.value = true
    }
  })
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
    <NuxtLayout v-else-if="isSharedFormView">
      <NuxtPage />
    </NuxtLayout>
    <NuxtLayout v-else-if="isSharedView" name="shared-view">
      <NuxtPage />
    </NuxtLayout>
    <NuxtLayout v-else name="dashboard">
      <template #sidebar>
        <DashboardHomeSidebar v-if="isHomeSidebarRoute" />
        <DashboardSidebar v-else />
      </template>
      <template #content>
        <!-- Workspace home: stable header + tabs + dynamic page content -->
        <div v-if="isHomeSidebarRoute" class="flex flex-col h-full w-full">
          <WorkspaceViewTopbar />
          <WorkspaceViewTabs />
          <div class="flex-1 overflow-auto">
            <NuxtPage :transition="false" />
          </div>
        </div>
        <!-- Non-workspace routes: render page directly -->
        <NuxtPage v-else :transition="false" />
      </template>
    </NuxtLayout>
    <DlgSharedBaseDuplicate v-if="isUIAllowed('baseDuplicate')" v-model="isDuplicateDlgOpen" />
  </div>
</template>

<style scoped></style>
