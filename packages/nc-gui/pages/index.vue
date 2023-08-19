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

const router = useRouter()

const route = router.currentRoute

const { projectsList } = storeToRefs(projectsStore)

watch(
  () => route.value.params.typeOrId,
  async () => {
    // if (!((route.value.name as string) || '').startsWith('typeOrId-projectId-')) {
    //   return
    // }
    await projectsStore.loadProjects('recent')

    if (!route.value.params.projectId && projectsList.value.length > 0) {
      await projectsStore.navigateToProject({ projectId: projectsList.value[0].id! })
    }
  },
  {
    immediate: true,
  },
)

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
    <NuxtLayout name="dashboard">
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
