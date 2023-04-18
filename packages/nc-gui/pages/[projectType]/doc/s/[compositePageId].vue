<script setup lang="ts">
definePageMeta({
  key: 'true',
  hideHeader: true,
  layout: 'docs',
  public: true,
  requiresAuth: false,
})
const { project } = storeToRefs(useProject())
const { setProject } = useProject()
const { isOpen: isSidebarOpen, toggleHasSidebar, toggle } = useSidebar('nc-left-sidebar')

const route = useRoute()

const {
  isNestedFetchErrored,
  isPageErrored,
  openedProjectId,
  nestedPagesOfProjects,
  openedPageId,
  flattenedNestedPages,
  openedPage,
  isNestedPublicPage,
} = storeToRefs(useDocStore())

const { fetchNestedPages, navigateToFirstPage } = useDocStore()

const isFetching = ref(true)

const isErrored = computed(() => {
  return isNestedFetchErrored.value || isPageErrored.value
})

onMounted(async () => {
  isFetching.value = true

  await fetchNestedPages({
    projectId: openedProjectId.value as string,
  })

  isFetching.value = false
})

watch(
  [project, isNestedPublicPage],
  () => {
    let meta = {}
    try {
      if (typeof project.value?.meta === 'string') {
        meta = JSON.parse(project.value?.meta ?? '{}')
      }
    } catch (e) {
      console.error(e)
    }

    if (isSidebarOpen.value) return

    if ((meta as any).isPublic) {
      toggle(true)
      toggleHasSidebar(true)
      navigateToFirstPage()
    }

    if (isNestedPublicPage.value) {
      toggle(true)
      toggleHasSidebar(true)
    } else {
      toggle(false)
      toggleHasSidebar(false)
    }
  },
  {
    deep: true,
  },
)

watch(
  () => flattenedNestedPages.value?.length ?? 0,
  () => {
    if (flattenedNestedPages.value?.length > 1) {
      toggle(true)
      toggleHasSidebar(true)
    }

    if (flattenedNestedPages.value?.length > 0 && !openedPageId.value) {
      navigateToFirstPage()
    }
  },
)
</script>

<template>
  <NuxtLayout id="content" :key="route.params.projectId as string" class="flex">
    <template v-if="isSidebarOpen && !isFetching" #sidebar>
      <DocsSideBar :project="project" />
    </template>
    <div v-if="isErrored">
      <DocsError />
    </div>
    <template v-else>
      <DocsPageView />
    </template>
  </NuxtLayout>
</template>
