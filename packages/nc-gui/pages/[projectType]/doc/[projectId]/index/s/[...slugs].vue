<script setup lang="ts">
definePageMeta({
  public: true,
  requiresAuth: false,
  key: 'true',
  hideHeader: true,
  layout: 'docs',
})

const { nestedPages, navigateToFirstPage } = useDocs()

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
</script>

<template>
  <DocsPageView :key="route.fullPath" />
</template>
