<script setup lang="ts">
const isPublic = inject(IsDocsPublicInj, ref(false))

const route = useRoute()
const { loadBookProject } = useProject()
const {
  fetchPublicBook,
  fetchPages,
  bookUrl,
  openedBook,
  fetchBooks,
  fetchNestedChildPagesFromRoute,
  openedPage,
  books,
  navigateToFirstBook,
  fetchAndOpenChildPageOfRootPages,
  fetchDrafts,
  isOnlyBookOpened,
} = useDocs()

const onAdminMount = async () => {
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

  await fetchDrafts(books.value[books.value.length - 1])
}

const onPublicMount = async () => {
  if (!route.params.slugs || route.params.slugs?.length === 0) {
    navigateTo(bookUrl(openedBook.value!.slug!))
    await fetchPublicBook({
      projectId: route.params.projectId as string,
    })
  } else if (route.params.slugs?.length === 1) {
    await fetchPublicBook({
      projectId: route.params.projectId as string,
      slug: route.params.slugs[0],
    })
    await fetchPages({
      book: openedBook.value!,
    })
  } else {
    await fetchPublicBook({
      projectId: route.params.projectId as string,
      slug: route.params.slugs[0],
    })
    await fetchNestedChildPagesFromRoute()
  }
  await fetchAndOpenChildPageOfRootPages()
}

watch(
  () => route.params.slugs,
  async (slugs) => {
    if (isPublic.value) return

    if (!slugs || slugs?.length === 0) {
      await navigateToFirstBook()
    }
  },
)

onMounted(async () => {
  if (isPublic.value) {
    await onPublicMount()
  } else {
    await onAdminMount()
  }
})
</script>

<template>
  <NuxtLayout id="content" class="flex">
    <template #sidebar>
      <DocsSideBar />
    </template>
    <DocsBook v-if="isOnlyBookOpened" />
    <DocsPage v-else-if="openedPage" :key="openedPage?.id" />
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
