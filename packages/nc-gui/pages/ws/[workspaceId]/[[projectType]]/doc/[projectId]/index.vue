<script setup lang="ts">
import {storeToRefs} from "pinia";

definePageMeta({
  key: 'true',
  hideHeader: true,
  layout: 'docs',
})

const route = useRoute()
const { isOpen: isSidebarOpen, toggleHasSidebar, toggle } = useSidebar('nc-left-sidebar')
const projectStore = useProject()
const {  loadBookProject, loadBookPublicProject } = projectStore
const { project, isLoading: isProjectLoading } = storeToRefs(projectStore)
const { fetchNestedPages, openChildPageTabsOfRootPages, isErrored, isPublic, nestedPublicParentPage, isFetching } = useDocs()

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
  if (isPublic.value) toggleSidebar(false)

  if (!project.value.id && !isProjectLoading.value) {
    if (isPublic.value) {
      await loadBookPublicProject()
    } else {
      await loadBookProject()
    }

    await fetchNestedPages()

    await openChildPageTabsOfRootPages()
  }
})

const isNestedPage = computed(() => {
  return !!nestedPublicParentPage.value?.is_nested_published
})

const isProjectPublic = computed(() => {
  if (typeof project.value.meta === 'string') {
    return JSON.parse(project.value.meta)?.isPublic
  }

  return (project.value.meta as any)?.isPublic
})

watch(
  [isErrored, isFetching, isNestedPage, isProjectPublic],
  () => {
    if ((!isPublic.value || isProjectPublic.value) && !isErrored.value) {
      toggleSidebar(true)
      return
    }

    let projectMeta
    if (typeof project.value.meta === 'string') {
      projectMeta = JSON.parse(project.value.meta)
    } else {
      projectMeta = project.value.meta
    }

    if (isErrored.value && !isFetching.value.nestedPages) {
      toggleSidebar(false)
    } else {
      const isPublicProject = isPublic.value && projectMeta?.isPublic
      const isNestedPages = isPublic.value && nestedPublicParentPage.value?.is_nested_published
      const isSinglePage = !isPublicProject && !isNestedPages

      if (isSinglePage) {
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
  <NuxtLayout id="content" :key="route.params.projectId as string" class="flex">
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
