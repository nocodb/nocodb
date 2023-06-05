<script lang="ts" setup>
import { onMounted, useRouter, useWorkspace } from '#imports'

definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const router = useRouter()
const route = $(router.currentRoute)

useProjects()
const { loadWorkspace } = useWorkspace()
const { loadProjects } = useProjects()

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

onMounted(async () => {
  await loadWorkspace(route.params.workspaceId as string)
  await loadProjects()
})

// todo:
const isSharedBase = ref(false)
const currentVersion = ref('')
</script>

<template>
  <NuxtLayout name="dashboard">
    <template #sidebar>
      <DashboardSidebar />
    </template>
    <template #content>
      <NuxtPage />
      <LazyDashboardSettingsModal
        v-model:model-value="dialogOpen"
        v-model:open-key="openDialogKey"
        v-model:data-sources-state="dataSourcesState"
        :project-id="projectId"
      />
    </template>
  </NuxtLayout>
</template>

<style scoped></style>
