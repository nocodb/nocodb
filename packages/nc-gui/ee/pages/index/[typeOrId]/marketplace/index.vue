<script setup lang="ts">
const { hideSidebar, isNewSidebarEnabled } = storeToRefs(useSidebarStore())

onMounted(() => {
  if (isNewSidebarEnabled.value) {
    hideSidebar.value = true
  }
})
</script>

<template>
  <NuxtPage />
</template>

<style scoped lang="scss"></style>
