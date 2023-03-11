<script setup lang="ts">
definePageMeta({
  key: 'true',
  hideHeader: true,
  layout: 'docs',
})

const { project } = useProject()
const { openedPageId } = useDocs()
</script>

<template>
  <DocsPageView v-if="project?.id && openedPageId" :key="project?.id" />
  <DocsBookView v-else-if="project?.id" />
</template>
