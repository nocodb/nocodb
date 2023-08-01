<script lang="ts" setup>
definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const dialogOpen = ref(false)

const openDialogKey = ref<string>('')

const dataSourcesState = ref<string>('')

const projectId = ref<string>()

function toggleDialog(value?: boolean, key?: string, dsState?: string, pId?: string) {
  dialogOpen.value = value ?? !dialogOpen.value
  openDialogKey.value = key || ''
  dataSourcesState.value = dsState || ''
  projectId.value = pId || ''
}

provide(ToggleDialogInj, toggleDialog)

// onMounted(async () => {
//   isLoading.value = true
//   try {
//     await loadWorkspace(route.params.workspaceId as string)
//     await loadProjects()
//   } finally {
//     isLoading.value = false
//   }
// })

// todo:
const isSharedBase = ref(false)
const currentVersion = ref('')
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
