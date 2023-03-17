<script setup lang="ts">
definePageMeta({
  public: true,
  requiresAuth: false,
  key: 'true',
  hideHeader: true,
  layout: 'docs',
})

const { toggleHasSidebar, toggle } = useSidebar('nc-left-sidebar')
const { loadPublicPageAndProject, fetchNestedPages, openChildPageTabsOfRootPages, openedPage, isNestedPublicPage } = useDocs()

const route = useRoute()

const toggleSidebar = (isOpen: boolean) => {
  if (isOpen) {
    toggleHasSidebar(true)
    toggle(true)
  } else {
    toggleHasSidebar(false)
    toggle(false)
  }
}

onMounted(async () => {
  toggleSidebar(false)

  await loadPublicPageAndProject()
})

watch(
  openedPage,
  async () => {
    if (!openedPage.value) return

    if (!isNestedPublicPage.value) {
      toggleSidebar(false)
      return
    }

    toggleSidebar(true)

    await fetchNestedPages()
    await openChildPageTabsOfRootPages()
  },
  {
    deep: true,
    immediate: true,
  },
)

watch(
  () => route.path,
  async () => {
    await loadPublicPageAndProject()
  },
)
</script>

<template>
  <DocsPageView :key="route.fullPath" />
</template>
