<script lang="ts" setup>
definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const dialogOpen = ref(false)

const openDialogKey = ref<string>('')

const dataSourcesState = ref<string>('')

const projectId = ref<string>()

const projectsStore = useProjects()

const { populateWorkspace } = useWorkspace()

const { signedIn } = useGlobal()

const router = useRouter()

const route = router.currentRoute

const { projectsList } = storeToRefs(projectsStore)

const autoNavigateToProject = async () => {
  const routeName = route.value.name as string
  if (routeName !== 'index-typeOrId' && routeName !== 'index') {
    return
  }

  await projectsStore.navigateToProject({ projectId: projectsList.value[0].id! })
}

const isSharedView = computed(() => {
  const routeName = (route.value.name as string) || ''

  // check route is not project page by route name
  return !routeName.startsWith('index-typeOrId-projectId-') && !['index', 'index-typeOrId'].includes(routeName)
})

async function handleRouteTypeIdChange() {
  // avoid loading projects for shared views
  if (isSharedView.value) {
    return
  }

  // avoid loading projects for shared base
  if (route.value.params.typeOrId === 'base') {
    await populateWorkspace()
    return
  }

  if (!signedIn.value) {
    navigateTo('/signIn')
    return
  }

  // Load projects
  await populateWorkspace()

  if (!route.value.params.projectId && projectsList.value.length > 0) {
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
  handleRouteTypeIdChange()
})

function toggleDialog(value?: boolean, key?: string, dsState?: string, pId?: string) {
  dialogOpen.value = value ?? !dialogOpen.value
  openDialogKey.value = key || ''
  dataSourcesState.value = dsState || ''
  projectId.value = pId || ''
}

provide(ToggleDialogInj, toggleDialog)
</script>

<template>
  <div>
    <NuxtLayout v-if="isSharedView" name="shared-view">
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
    <LazyDashboardSettingsModal
      v-model:model-value="dialogOpen"
      v-model:open-key="openDialogKey"
      v-model:data-sources-state="dataSourcesState"
      :project-id="projectId"
    />
  </div>
</template>

<style scoped></style>
