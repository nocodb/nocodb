<script setup lang="ts">
const { project } = storeToRefs(useProject())

const { openedPageId } = storeToRefs(useDocStore())
</script>

<template>
  <LazyDocsPageView v-if="project?.id && openedPageId" />
</template>
