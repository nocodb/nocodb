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
const isSidebarOpen = ref(false)

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

    if ((meta as any).isPublic) {
      isSidebarOpen.value = true
      navigateToFirstPage()
    }

    if (isNestedPublicPage.value) {
      isSidebarOpen.value = true
    } else {
      isSidebarOpen.value = false
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
      isSidebarOpen.value = true
    }

    if (flattenedNestedPages.value?.length > 0 && !openedPageId.value) {
      navigateToFirstPage()
    }
  },
)
</script>

<template>
  <NuxtLayout id="content" :key="`${route.params.projectId as string}`" name="dashboard">
    <template #sidebar>
      <LazyDocsSideBar v-if="isSidebarOpen && !isFetching" :project="project" />
    </template>
    <template #content>
      <div class="flex flex-row">
        <div v-if="isErrored">
          <LazyDocsError />
        </div>
        <template v-else>
          <LazyDocsPageView />
        </template>
      </div>
    </template>
  </NuxtLayout>
</template>
