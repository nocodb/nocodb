<script setup lang="ts">
const route = useRoute()

const tab = computed(() => baseAdminSlugToTab[route.params.page as string] || 'collaborator')
</script>

<template>
  <ProjectView :tab="tab" />
</template>
