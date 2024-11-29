<script lang="ts" setup>
definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

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

  await basesStore.navigateToProject({ baseId: basesList.value[0].id! })
}

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

async function handleRouteTypeIdChange() {
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

watch(
  () => route.value.params.typeOrId,
  () => {
    handleRouteTypeIdChange()
  },
)

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
</script>

<template>
  <div>
    <NuxtLayout v-if="isSharedFormView">
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
