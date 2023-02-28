<script setup lang="ts">
import { useShortcuts } from './utils'

const isPublic = inject(IsDocsPublicInj, ref(false))

const route = useRoute()

const { fetchNestedPages, openChildPageTabsOfRootPages, navigateToFirstPage, isErrored, isNoPageOpen, nestedPages } = useDocs()

useShortcuts()

const { isOpen: isSidebarOpen, toggleHasSidebar: toggleSidebar } = useSidebar('nc-left-sidebar', {
  isOpen: true,
})

const isLoading = ref(true)

const onAdminMount = async () => {
  await fetchNestedPages()

  await openChildPageTabsOfRootPages()
}

const onPublicMount = async () => {
  // Remove trailing slash in url
  const slugs = route.params.slugs && (route.params.slugs as string[])?.filter((slug) => slug !== '')

  await fetchNestedPages()

  if (slugs.length === 0) await navigateToFirstPage()

  await openChildPageTabsOfRootPages()
}

watch(
  [isErrored, isLoading],
  () => {
    if (isErrored.value && !isLoading.value) {
      toggleSidebar(false)
    } else {
      if (isPublic.value && nestedPages.value.length < 1) return

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
    <template v-else>
      <DocsBookView v-if="isNoPageOpen && !isPublic" />
      <DocsPageView v-else />
    </template>
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
