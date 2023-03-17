<script setup lang="ts">
import { ref, storeToRefs, useProject } from '#imports'

definePageMeta({
  key: 'true',
  // hideHeader: true,
  // layout: 'docs',
})

const { loadBookProject } = useProject()
const { project, isLoading: isProjectLoading } = storeToRefs(useProject())
const { toggleHasSidebar, toggle } = useSidebar('nc-left-sidebar')
const { openedPageId, projectId, fetchNestedPages, openChildPageTabsOfRootPages } = useDocs()

const isLoading = ref(false)

const toggleSidebar = (isOpen: boolean) => {
  if (isOpen) {
    toggleHasSidebar(true)
    toggle(true)
  } else {
    toggleHasSidebar(false)
    toggle(false)
  }
}

const onCompositePageIdChange = async () => {
  toggleSidebar(true)

  // if (project.value.id || isProjectLoading.value) return

  try {
    await loadBookProject(projectId)
  } catch (error) {
    console.error(error)
    await navigateTo('/')
    return
  }

  await fetchNestedPages()

  await openChildPageTabsOfRootPages()
}

onMounted(async () => {
  isLoading.value = true
  try {
    await onCompositePageIdChange()
  } catch (error) {
    console.error(error)
  } finally {
    isLoading.value = false
  }
})

watch(
  () => projectId,
  async () => {
    try {
      await onCompositePageIdChange()
    } catch (error) {
      console.error(error)
    }
  },
)
</script>

<template>
  <div v-if="isLoading"></div>
  <template v-else>
    <DocsPageView v-if="project?.id && openedPageId" :key="project?.id" />
    <DocsBookView v-else-if="project?.id" />
  </template>
</template>
