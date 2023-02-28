<script setup lang="ts">
definePageMeta({
  key: 'true',
  hideHeader: true,
  layout: 'docs',
})

const route = useRoute()
const { isOpen: isSidebarOpen, toggleHasSidebar, toggle } = useSidebar('nc-left-sidebar')
const { project, loadBookProject, isLoading: isProjectLoading } = useProject()
const { fetchNestedPages, openChildPageTabsOfRootPages, isErrored, isPublic, nestedPublicParentPage } = useDocs()

const isLoading = ref(true)

onMounted(async () => {
  isLoading.value = true
  if (!project.value.id && !isProjectLoading.value) {
    console.log('loadBookProject', isPublic.value)
    if (!isPublic.value) await loadBookProject()

    await fetchNestedPages()

    await openChildPageTabsOfRootPages()
  }
  isLoading.value = false
})

const toggleSidebar = (isOpen: boolean) => {
  if (isOpen) {
    toggleHasSidebar(true)
    toggle(true)
  } else {
    toggleHasSidebar(false)
    toggle(false)
  }
}

watch(
  [isErrored, isLoading, nestedPublicParentPage.value?.is_nested_published],
  () => {
    if (isErrored.value && !isLoading.value) {
      toggleSidebar(false)
    } else {
      if (isPublic.value && !nestedPublicParentPage.value?.is_nested_published && !isLoading.value) {
        toggleSidebar(false)
        return
      }

      toggleSidebar(true)
    }
  },
  {
    immediate: true,
    deep: true,
  },
)

// todo: hacky. find a better way to reset the state. Tricky due nested public pages and key-ing of components
// cannot be done
watch(
  () => route.fullPath,
  () => {
    if (isErrored.value) {
      // reload window
      window.location.reload()
    }
  },
)
</script>

<template>
  <NuxtLayout id="content" class="flex">
    <template v-if="isSidebarOpen" #sidebar>
      <DocsSideBar :key="isPublic.toString()" />
    </template>
    <div v-if="isErrored">
      <DocsError />
    </div>
    <template v-else>
      <NuxtPage :page-key="$route.params.projectId" />
    </template>
  </NuxtLayout>
</template>

<style lang="scss" scoped>
:global(#nc-sidebar-left .ant-layout-sider-collapsed) {
  @apply !w-0 !max-w-0 !min-w-0 overflow-x-hidden;
}

.nc-left-sidebar {
  .nc-sidebar-left-toggle-icon {
    @apply opacity-0 transition-opacity duration-200 text-white/80 hover:text-white/100;

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
