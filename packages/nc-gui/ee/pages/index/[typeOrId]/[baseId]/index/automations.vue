<script setup lang="ts">
const { activeSidebarTab } = storeToRefs(useSidebarStore())

activeSidebarTab.value = 'automations'
</script>

<template>
  <NuxtPage />
</template>
