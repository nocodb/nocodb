<script setup lang="ts">
const dashboardStore = useDashboardStore()
const { fetchLayouts } = dashboardStore
const { base } = storeToRefs(useBase())

onMounted(async () => {
  base.value.isLoading = true
  try {
    await fetchLayouts({ baseId: base.value.id! })
  } catch {
    console.error('Error while fetching layouts')
  } finally {
    base.value.isLoading = false
  }
})
</script>

<template>
  <div>
    <NuxtPage />
  </div>
</template>
