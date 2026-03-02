<script setup lang="ts">
const { activeSidebarTab } = storeToRefs(useSidebarStore())

activeSidebarTab.value = 'settings'
</script>

<template>
  <NuxtPage />
</template>
