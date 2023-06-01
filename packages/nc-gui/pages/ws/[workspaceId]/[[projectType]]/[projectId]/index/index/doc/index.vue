<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <NuxtLayout>
    <DocsBookView v-if="!route.params.pageId" />
    <NuxtPage v-else />
  </NuxtLayout>
</template>
