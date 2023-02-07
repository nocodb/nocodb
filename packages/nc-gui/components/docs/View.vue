<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
const isPublic = inject(IsDocsPublicInj, ref(false))

const route = useRoute()
const {
  fetchPublicBook,
  fetchNestedPages,
  bookUrl,
  openedBook,
  fetchBooks,
  openedPage,
  books,
  navigateToFirstBook,
  openChildPageOfRootPages,
  isOnlyBookOpened,
  navigateToFirstPage,
  isErrored,
  addNewPage,
  getParentOfPage,
} = useDocs()

const { isOpen: isSidebarOpen, toggleHasSidebar: toggleSidebar } = useSidebar('nc-left-sidebar', {
  isOpen: true,
})

const shortCuts = [
  {
    condition: (e: KeyboardEvent) => e.code === 'KeyN' && e.altKey,
    action: (e: KeyboardEvent) => {
      e.preventDefault()
      if (isPublic.value) return

      addNewPage(openedPage.value?.parent_page_id)
    },
  },
  {
    condition: (e: KeyboardEvent) => e.code === 'KeyM' && e.altKey,
    action: (e: KeyboardEvent) => {
      e.preventDefault()
      if (isPublic.value) return

      addNewPage(openedPage.value?.id)
    },
  },
  {
    condition: (e: KeyboardEvent) => e.code === 'KeyB' && e.altKey,
    action: (e: KeyboardEvent) => {
      e.preventDefault()
      if (isPublic.value) return

      const parentPage = openedPage.value?.parent_page_id ? getParentOfPage(openedPage.value.parent_page_id) : null
      addNewPage(parentPage?.parent_page_id)
    },
  },
]

const isLoading = ref(true)

const onAdminMount = async () => {
  await fetchBooks()
  await fetchNestedPages({
    book: books.value[0],
  })
  // Navigate to the first page if there is no page selected and only one book exists
  if (route.params.slugs?.length < 1 && books.value.length > 0) {
    await navigateToFirstBook()
  }

  await openChildPageOfRootPages()
}

const onPublicMount = async () => {
  const slugs = route.params.slugs && (route.params.slugs as string[])?.filter((slug) => slug !== '')
  if (!slugs || slugs?.length === 0) {
    await fetchPublicBook({
      projectId: route.params.projectId as string,
    })
    await navigateTo(bookUrl(books.value[0].slug!))

    if (books.value.length === 0) return
    await fetchNestedPages({
      book: books.value[0],
    })
    await navigateToFirstPage()
  } else if (slugs?.length === 1) {
    await fetchPublicBook({
      projectId: route.params.projectId as string,
      slug: slugs[0],
    })

    if (books.value.length === 0) return
    await fetchNestedPages({
      book: books.value[0],
    })
    await navigateToFirstPage()
  } else {
    await fetchPublicBook({
      projectId: route.params.projectId as string,
      slug: slugs[0],
    })
    if (books.value.length === 0) return
    await fetchNestedPages({
      book: books.value[0],
    })
  }
  await openChildPageOfRootPages()
}

watch(
  () => route.params.slugs,
  async (slugs) => {
    if (isPublic.value) return

    if (!slugs || slugs?.length === 0) {
      await navigateToFirstBook()
    }
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

// Listen to shortcuts
onKeyStroke(
  (e) => shortCuts.some((shortCut) => shortCut.condition(e)),
  (e) => {
    const shortCut = shortCuts.find((shortCut) => shortCut.condition(e))
    if (shortCut) {
      // This hack to prevent having artifacts on the page when pressing the shortcut. On page we delete the artifact so should not excute the shortcut till then
      setTimeout(() => {
        shortCut.action(e)
      }, 100)
    }
  },
  { eventName: 'keydown' },
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
    <template v-if="isSidebarOpen" #sidebar>
      <DocsSideBar />
    </template>
    <div v-if="isErrored">
      <DocsError />
    </div>
    <div v-else-if="isLoading"></div>
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
