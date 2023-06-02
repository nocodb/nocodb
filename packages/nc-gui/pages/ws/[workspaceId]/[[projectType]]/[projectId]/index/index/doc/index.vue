<script setup lang="ts">
const route = useRoute()

const { openedProjectId } = storeToRefs(useDocStore())
const { fetchNestedPages } = useDocStore()

onMounted(() => {
  fetchNestedPages({
    projectId: openedProjectId.value,
  })
})
</script>

<template>
  <NuxtLayout>
    <DocsBookView v-if="!route.params.pageId" />
    <NuxtPage v-else />
  </NuxtLayout>
</template>
