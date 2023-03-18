<script setup lang="ts">
const { project } = storeToRefs(useProject())
</script>

<template>
  <DocsBookView v-if="project?.id" />
</template>
