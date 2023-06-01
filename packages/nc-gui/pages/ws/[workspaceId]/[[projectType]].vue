<script lang="ts" setup>
import { onMounted, storeToRefs, useRouter, useWorkspace } from '#imports'
import { useProject } from '~/store/project'

definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const router = useRouter()
const route = $(router.currentRoute)

const { project } = storeToRefs(useProject())

const workspaceStore = useWorkspace()

const { workspace } = storeToRefs(workspaceStore)

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
  await workspaceStore.loadWorkspace(route.params.workspaceId as string)
  await workspaceStore.loadProjects()
})

// create a new sidebar state
const { isOpen, toggle } = useSidebar('nc-left-sidebar', { hasSidebar: true, isOpen: true })

// todo:
const isSharedBase = ref(false)
const currentVersion = ref('')
</script>

<template>
  <NuxtLayout name="dashboard">
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
