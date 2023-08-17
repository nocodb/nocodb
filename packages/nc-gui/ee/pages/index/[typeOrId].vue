<script lang="ts" setup>
const router = useRouter()

const route = router.currentRoute
/*
const workspaceStore = useWorkspace()
const { populateWorkspace } = workspaceStore
const { collaborators } = storeToRefs(workspaceStore)

const projectsStore = useProjects()

watch(
  () => route.value.params.projectTypeOrWorkspaceId ?? route.value.params.typeOrId,
  async (newId, oldId) => {
    if (newId === 'nc') {
      workspaceStore.setLoadingState(false)
      workspaceStore.isWorkspaceLoading = false
      return
    }

    if (newId === 'base') {
      workspaceStore.setLoadingState(false)
      projectsStore.loadProjects()
      return
    }

    if (!newId || (oldId !== newId && oldId)) {
      projectsStore.clearProjects()
      collaborators.value = []
      return
    }

    populateWorkspace()
  },
  {
    immediate: true,
  },
)*/
</script>

<template>
  <NuxtPage :page-key="route.params.projectTypeOrWorkspaceId" />
</template>
