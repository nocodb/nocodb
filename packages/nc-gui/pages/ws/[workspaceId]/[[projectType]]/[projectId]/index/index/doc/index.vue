<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <NuxtLayout name="dashboard">
    <template #content>
      <DocsBookView v-if="!route.params.pageId" />
      <NuxtPage v-else />
    </template>
  </NuxtLayout>
</template>
