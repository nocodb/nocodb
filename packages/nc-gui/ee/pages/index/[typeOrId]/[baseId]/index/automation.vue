<script setup lang="ts">
const { activeSidebarTab } = storeToRefs(useSidebarStore())

activeSidebarTab.value = 'automation'
</script>

<template>
  <NuxtPage />
</template>
