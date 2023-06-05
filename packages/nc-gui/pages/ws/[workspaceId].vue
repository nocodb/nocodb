<script lang="ts" setup>
const router = useRouter()

const route = $(router.currentRoute)

const { isWorkspaceLoading, collaborators, activeWorkspace, workspaces } = storeToRefs(useWorkspace())
const { loadActiveWorkspace } = useWorkspace()
const projectsStore = useProjects()

watch(
  () => route.params.workspaceId,
  async (newId, oldId) => {
    // skip and reset if workspace not selected
    const workspace = workspaces.value.find((w) => w.id === newId)
    console.log('workspace changed', newId, workspace, route.params)
    if (!newId || (oldId !== newId && oldId)) {
      projectsStore.clearProjects()
      collaborators.value = []
      return
    }

    if (!workspace) {
      loadActiveWorkspace()
    }
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div v-if="isWorkspaceLoading"></div>
  <NuxtPage v-else :page-key="route.params.workspaceId" />
</template>
