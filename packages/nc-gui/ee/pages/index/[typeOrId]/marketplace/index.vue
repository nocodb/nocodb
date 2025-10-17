<script setup lang="ts">
const { hideSidebar } = storeToRefs(useSidebarStore())

onMounted(() => {
  hideSidebar.value = true
})
</script>

<template>
  <NuxtPage />
</template>

<style scoped lang="scss"></style>
