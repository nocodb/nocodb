<script lang="ts" setup>
definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const { showOnboardingFlow } = useOnboardingFlow()

const { isSharedBase, isSharedErd } = storeToRefs(useBase())

const basesStore = useBases()

const { populateWorkspace } = useWorkspace()

const { signedIn } = useGlobal()

const { isUIAllowed } = useRoles()

const router = useRouter()

const route = router.currentRoute

const { basesList } = storeToRefs(basesStore)

const autoNavigateToProject = async () => {
  const routeName = route.value.name as string
  if (routeName !== 'index-typeOrId' && routeName !== 'index') {
    return
  }

  const lastVisitedBase = ncLastVisitedBase().get()

  const firstBase = lastVisitedBase
    ? basesStore.basesList.find((b) => b.id === lastVisitedBase) ?? basesStore.basesList[0]
    : basesStore.basesList[0]

  if (!firstBase?.id) return

  await basesStore.navigateToProject({ baseId: firstBase.id!, query: extractAiBaseCreateQueryParams(route.value.query) })
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

  if (!route.value.params.baseId && basesList.value.length > 0) {
    await autoNavigateToProject()
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
        <DashboardSidebar />
      </template>
      <template #content>
        <NuxtPage />
      </template>
    </NuxtLayout>
    <DlgSharedBaseDuplicate v-if="isUIAllowed('baseDuplicate')" v-model="isDuplicateDlgOpen" />
  </div>
</template>

<style scoped></style>
