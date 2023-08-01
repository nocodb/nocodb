<script lang="ts" setup>
const router = useRouter()

const route = $(router.currentRoute)

const { isWorkspaceLoading, collaborators } = storeToRefs(useWorkspace())
const { populateWorkspace } = useWorkspace()
const projectsStore = useProjects()

watch(
  () => route.params.workspaceId,
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
  <div v-if="isWorkspaceLoading"></div>
  <NuxtPage v-else :page-key="route.params.workspaceId" />
</template>
