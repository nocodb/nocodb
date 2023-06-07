<script setup lang="ts">
const route = useRoute()

const { openedProjectId } = storeToRefs(useDocStore())
const { populatedNestedPages } = useDocStore()

onMounted(() => {
  populatedNestedPages({
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
