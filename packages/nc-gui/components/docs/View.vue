<script setup lang="ts">
const isPublic = inject(IsDocsPublicInj, ref(false))

const route = useRoute()
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
  navigateToFirstPage,
} = useDocs()

const isLoading = ref(true)

const onAdminMount = async () => {
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

  await fetchAndOpenChildPageOfRootPages()
  await fetchDrafts(books.value[books.value.length - 1])
}

const onPublicMount = async () => {
  const slugs = route.params.slugs && (route.params.slugs as string[])?.filter((slug) => slug !== '')
  if (!slugs || slugs?.length === 0) {
    await navigateTo(bookUrl(openedBook.value!.slug!))
    await fetchPublicBook({
      projectId: route.params.projectId as string,
    })
    await fetchPages({
      book: openedBook.value!,
    })
    await navigateToFirstPage()
  } else if (slugs?.length === 1) {
    await fetchPublicBook({
      projectId: route.params.projectId as string,
      slug: slugs[0],
    })
    await fetchPages({
      book: openedBook.value!,
    })
    await navigateToFirstPage()
  } else {
    await fetchPublicBook({
      projectId: route.params.projectId as string,
      slug: slugs[0],
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
  isLoading.value = true
  try {
    if (isPublic.value) {
      await onPublicMount()
    } else {
      await onAdminMount()
    }
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <NuxtLayout id="content" class="flex">
    <template #sidebar>
      <DocsSideBar />
    </template>
    <div v-if="isLoading"></div>
    <DocsBookView v-else-if="isOnlyBookOpened" :key="openedBook?.id" />
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
