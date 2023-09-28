<script setup lang="ts">
const route = useRoute()

const docStore = useDocStore()
const { populatedNestedPages } = docStore
const { openedProjectId } = storeToRefs(docStore)

const { base } = storeToRefs(useBase())

onMounted(async () => {
  if (base.value) base.value.isLoading = true

  try {
    await populatedNestedPages({
      baseId: openedProjectId.value,
    })
  } catch (e) {
    console.error(e)
  }

  if (base.value) base.value.isLoading = false
})
</script>

<template>
  <NuxtLayout>
    <LazyDocsBookView v-if="!route.params.pageId" />
    <NuxtPage v-else />
  </NuxtLayout>
</template>
