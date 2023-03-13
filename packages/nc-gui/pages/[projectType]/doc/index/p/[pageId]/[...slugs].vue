<script setup lang="ts">
definePageMeta({
  key: 'true',
  hideHeader: true,
  layout: 'docs',
})

const { project, loadBookProject, isLoading: isProjectLoading } = useProject()
const { toggleHasSidebar, toggle } = useSidebar('nc-left-sidebar')
const { openedPageId, projectId, fetchNestedPages, openChildPageTabsOfRootPages, isPublic } = useDocs()

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

  if (project.value.id || isProjectLoading.value) return

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
  await onCompositePageIdChange()
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
  <DocsPageView v-if="project?.id && openedPageId" :key="project?.id" />
  <DocsBookView v-else-if="project?.id" />
</template>
