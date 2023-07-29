<script setup lang="ts">
const route = useRoute()

const { openedProjectId } = storeToRefs(useDocStore())
const { populatedNestedPages } = useDocStore()
const { project } = storeToRefs(useProject())

onMounted(async () => {
  if (project.value) project.value.isLoading = true

  try {
    await populatedNestedPages({
      projectId: openedProjectId.value,
    })
  } catch (e) {
    console.error(e)
  }

  if (project.value) project.value.isLoading = false
})
</script>

<template>
  <NuxtLayout>
    <DocsBookView v-if="!route.params.pageId" />
    <NuxtPage v-else />
  </NuxtLayout>
</template>
