<script setup lang="ts">
const { project } = storeToRefs(useProject())

const { openedPageId } = storeToRefs(useDocStore())
</script>

<template>
  <DocsPageView v-if="project?.id && openedPageId" />
</template>
