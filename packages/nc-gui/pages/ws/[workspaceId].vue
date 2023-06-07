<script lang="ts" setup>
const router = useRouter()

const route = $(router.currentRoute)

const { isWorkspaceLoading, collaborators } = storeToRefs(useWorkspace())
const { populateActiveWorkspace } = useWorkspace()
const projectsStore = useProjects()

watch(
  () => route.params.workspaceId,
  async (newId, oldId) => {
    if (!newId || (oldId !== newId && oldId)) {
      projectsStore.clearProjects()
      collaborators.value = []
      return
    }

    populateActiveWorkspace()
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
