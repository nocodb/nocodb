<script setup lang="ts">
definePageMeta({
  public: true,
  requiresAuth: false,
  key: 'true',
  hideHeader: true,
  // layout: 'docs',
})

const { nestedPages, navigateToFirstPage, routePageSlugs, nestedPublicParentPage, openedPage } = useDocs()

const route = useRoute()

watch(
  nestedPages,
  async () => {
    const slugs = route.params.slugs && (route.params.slugs as string[])?.filter((slug) => slug !== '')

    if (slugs.length === 0) await navigateToFirstPage()
  },
  {
    deep: true,
  },
)

watch(
  () => openedPage.value?.id,
  (oldId, newId) => {
    if (!openedPage.value) return
    if (oldId === newId) return

    if (!nestedPublicParentPage.value && !!openedPage.value?.is_nested_published) {
      nestedPublicParentPage.value = JSON.parse(JSON.stringify(openedPage.value))
    } else if (routePageSlugs.value[0] !== nestedPublicParentPage.value?.id) {
      nestedPublicParentPage.value = undefined
    }
  },
  {
    deep: true,
    immediate: true,
  },
)
</script>

<template>
  <DocsPageView :key="route.fullPath" />
</template>
