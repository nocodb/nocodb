<script lang="ts" setup>
const router = useRouter()

const route = router.currentRoute

const { isWorkspaceLoading, collaborators } = storeToRefs(useWorkspace())
const { populateWorkspace } = useWorkspace()
const projectsStore = useProjects()

watch(
  () => route.value.params.workspaceId,
  async (newId, oldId) => {
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
)
</script>

<template>
  <NuxtPage :page-key="route.params.workspaceId" />
</template>
