<script setup lang="ts">
import { useShortcuts } from './utils'

const isPublic = inject(IsDocsPublicInj, ref(false))

const route = useRoute()

const {
  fetchPublicBook,
  fetchNestedPages,
  bookUrl,
  openedBook,
  fetchBooks,
  books,
  navigateToFirstBook,
  openChildPageOfRootPages,
  isOnlyBookOpened,
  navigateToFirstPage,
  isErrored,
  isFetching,
} = useDocs()

useShortcuts()

const { isOpen: isSidebarOpen, toggleHasSidebar: toggleSidebar } = useSidebar('nc-left-sidebar', {
  isOpen: true,
})

const isLoading = ref(true)

const onAdminMount = async () => {
  await fetchBooks()

  // Navigate to the first page if there is no page selected and only one book exists
  if (route.params.slugs?.length < 1 && books.value.length > 0) {
    await navigateToFirstBook()
  }

  isLoading.value = false
  await fetchNestedPages({
    book: books.value[0],
  })

  await openChildPageOfRootPages()
}

const onPublicMount = async () => {
  // Remove trailing slash in url
  const slugs = route.params.slugs && (route.params.slugs as string[])?.filter((slug) => slug !== '')

  await fetchPublicBook({
    projectId: route.params.projectId as string,
    slug: slugs?.length > 0 ? slugs[0] : undefined,
  })

  if (!slugs || slugs?.length === 0) await navigateTo(bookUrl(books.value[0].slug!))

  if (books.value.length === 0) return

  isLoading.value = false

  await fetchNestedPages({
    book: books.value[0],
  })

  if (slugs.length === 1) await navigateToFirstPage()

  await openChildPageOfRootPages()
}

watch(
  () => route.params.slugs,
  async (slugs) => {
    if (isPublic.value) return
    if (slugs?.length > 0) return

    await navigateToFirstBook()
  },
  {
    deep: true,
  },
)

watch(
  [isErrored, isLoading],
  () => {
    if (isErrored.value && !isLoading.value) {
      toggleSidebar(false)
    } else {
      toggleSidebar(true)
    }
  },
  {
    immediate: true,
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
    <template v-if="isSidebarOpen" #sidebar>
      <DocsSideBar />
    </template>
    <div v-if="isErrored">
      <DocsError />
    </div>

    <DocsBookView v-if="isOnlyBookOpened" :key="openedBook?.id" />
    <DocsPageView v-else-if="!isFetching.books" />
  </NuxtLayout>
</template>

<style lang="scss" scoped>
:global(#nc-sidebar-left .ant-layout-sider-collapsed) {
  @apply !w-0 !max-w-0 !min-w-0 overflow-x-hidden;
}

.nc-left-sidebar {
  .nc-sidebar-left-toggle-icon {
    @apply opacity-0 transition-opacity duration-200 transition-colors text-white/80 hover:text-white/100;

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
