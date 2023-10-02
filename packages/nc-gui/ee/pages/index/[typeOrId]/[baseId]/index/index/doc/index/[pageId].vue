<script setup lang="ts">
const { base } = storeToRefs(useBase())

const { openedPageId } = storeToRefs(useDocStore())
</script>

<template>
  <LazyDocsPageView v-if="base?.id && openedPageId" />
</template>
