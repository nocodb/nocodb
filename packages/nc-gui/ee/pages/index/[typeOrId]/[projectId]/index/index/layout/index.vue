<script setup lang="ts">
const dashboardStore = useDashboardStore()
const { fetchLayouts } = dashboardStore
const { project } = storeToRefs(useProject())

onMounted(async () => {
  project.value.isLoading = true
  try {
    await fetchLayouts({ projectId: project.value.id! })
  } catch {
    console.error('Error while fetching layouts')
  } finally {
    project.value.isLoading = false
  }
})
</script>

<template>
  <div>
    <NuxtPage />
  </div>
</template>
