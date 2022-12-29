<script setup lang="ts">
definePageMeta({
  key: 'true',
  hideHeader: true,
  layout: 'docs',
})

const route = useRoute()
const { loadBookProject } = useProject()
const { fetchBooks, fetchNestedChildPagesFromRoute, openedPage, openedBook, books, navigateToFirstBook, fetchPages } = useDocs()

onMounted(async () => {
  await loadBookProject()
  await fetchBooks()

  await fetchNestedChildPagesFromRoute()
  // Navigate to the first page if there is no page selected and only one book exists
  if (route.params.slugs?.length < 1 && books.value.length > 0) {
    await navigateToFirstBook()
  } else if (route.params.slugs?.length === 1) {
    await fetchPages({
      book: openedBook.value!,
    })
  }
})

watch(
  () => route.params.slugs,
  async (slugs) => {
    if (!slugs || slugs?.length === 0) {
      await navigateToFirstBook()
    }
  },
)

// watch(
//   openedPage,
//   (page) => {
//     console.log('watch', page?.id)
//   },
//   { deep: true, immediate: true },
// )
</script>

<template>
  <NuxtLayout id="content" class="flex">
    <template #sidebar>
      <DocsSideBar />
    </template>
    <DocsPage v-if="openedPage" :key="openedPage?.id" />
    <div v-else>
      <div class="flex flex-col items-center justify-center h-full">
        <a-icon type="file-text" class="text-4xl" />
        <div class="text-2xl mt-4">No page selected</div>
      </div>
    </div>
  </NuxtLayout>
</template>

<style lang="scss" scoped>
:global(#nc-sidebar-left .ant-layout-sider-collapsed) {
  @apply !w-0 !max-w-0 !min-w-0 overflow-x-hidden;
}

.nc-left-sidebar {
  .nc-sidebar-left-toggle-icon {
    @apply opacity-0 transition-opacity duration-200 transition-color text-white/80 hover:text-white/100;

    .nc-left-sidebar {
      @apply !border-r-0;
    }
  }

  &:hover .nc-sidebar-left-toggle-icon {
    @apply opacity-100;
  }
}

:deep(.ant-dropdown-menu-submenu-title) {
  @apply py-0;
}
</style>
