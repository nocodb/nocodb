<script setup lang="ts">
const route = useRoute()

const tab = computed(() => baseSettingsSlugToTab[route.params.page as string] || 'collaborator')
</script>

<template>
  <ProjectView :tab="tab" />
</template>
