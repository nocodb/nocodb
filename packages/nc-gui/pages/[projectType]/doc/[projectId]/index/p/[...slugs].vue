<script setup lang="ts">
definePageMeta({
  key: 'true',
  hideHeader: true,
  layout: 'docs',
})

const { project } = useProject()
</script>

<template>
  <DocsPageView v-if="project?.id" :key="project?.id" />
</template>
