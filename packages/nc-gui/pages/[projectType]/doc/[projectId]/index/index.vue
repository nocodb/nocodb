<script setup lang="ts">
definePageMeta({
  key: 'true',
  hideHeader: true,
  layout: 'docs',
})

const { project } = useProject()
</script>

<template>
  <DocsBookView v-if="project?.id" :key="project?.id" />
</template>
