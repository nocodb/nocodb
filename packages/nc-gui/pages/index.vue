<script lang="ts" setup>
definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const dialogOpen = ref(false)

const openDialogKey = ref<string>('')

const dataSourcesState = ref<string>('')

const baseId = ref<string>()

const basesStore = useBases()

const { populateWorkspace } = useWorkspace()

const { signedIn, ncNavigateTo } = useGlobal()

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
  return !routeName.startsWith('index-typeOrId-baseId-') && !['index', 'index-typeOrId'].includes(routeName)
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
  if (route.value.query?.continueAfterSignIn) {
    localStorage.removeItem('continueAfterSignIn')
    return navigateTo(route.value.query.continueAfterSignIn as string)
  } else {
    const continueAfterSignIn = localStorage.getItem('continueAfterSignIn')

    if (continueAfterSignIn) {
      return navigateTo({
        path: continueAfterSignIn,
        query: route.value.query,
      })
    }
  }

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

function toggleDialog(value?: boolean, key?: string, dsState?: string, pId?: string) {
  dialogOpen.value = value ?? !dialogOpen.value
  openDialogKey.value = key || ''
  dataSourcesState.value = dsState || ''
  baseId.value = pId || ''
}

provide(ToggleDialogInj, toggleDialog)

const { $e, $poller } = useNuxtApp()

const DlgSharedBaseDuplicateOnOk = async (jobData: { id: string; base_id: string; workspace_id: string }) => {
  await populateWorkspace()

  $poller.subscribe(
    { id: jobData.id },
    async (data: {
      id: string
      status?: string
      data?: {
        error?: {
          message: string
        }
        message?: string
        result?: any
      }
    }) => {
      if (data.status !== 'close') {
        if (data.status === JobStatus.COMPLETED) {
          await ncNavigateTo({
            baseId: jobData.base_id,
          })
        } else if (data.status === JobStatus.FAILED) {
          message.error('Failed to duplicate shared base')
          await populateWorkspace()
        }
      }
    },
  )

  $e('a:base:duplicate-shared-base')
}
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
    <LazyDashboardSettingsModal
      v-model:model-value="dialogOpen"
      v-model:open-key="openDialogKey"
      v-model:data-sources-state="dataSourcesState"
      :base-id="baseId"
    />
    <DlgSharedBaseDuplicate
      v-if="isUIAllowed('baseDuplicate')"
      v-model="isDuplicateDlgOpen"
      :shared-base-id="sharedBaseId"
      :on-ok="DlgSharedBaseDuplicateOnOk"
    />
  </div>
</template>

<style scoped></style>
