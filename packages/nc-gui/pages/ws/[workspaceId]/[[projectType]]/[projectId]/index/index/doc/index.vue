<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <DocsBookView v-if="!route.params.pageId" />
  <NuxtPage v-else />
</template>
