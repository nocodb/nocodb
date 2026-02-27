<script setup lang="ts">
const { activeSidebarTab } = storeToRefs(useSidebarStore())

activeSidebarTab.value = 'admin'
</script>

<template>
  <NuxtPage />
</template>
