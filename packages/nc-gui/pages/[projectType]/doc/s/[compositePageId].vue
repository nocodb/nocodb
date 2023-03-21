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

const { isNestedFetchErrored, isPageErrored, openedProjectId, nestedPagesOfProjects, openedPageId, flattenedNestedPages } =
  storeToRefs(useDocStore())

const { fetchNestedPages, navigateToFirstPage } = useDocStore()

const isFetching = ref(true)

const isErrored = computed(() => {
  return isNestedFetchErrored.value || isPageErrored.value
})

onMounted(async () => {
  isFetching.value = true

  setProject({ id: openedProjectId.value })
  await fetchNestedPages({
    projectId: openedProjectId.value as string,
  })

  isFetching.value = false
})

watch(
  () => flattenedNestedPages.value?.length ?? 0,
  () => {
    if (flattenedNestedPages.value?.length > 1) {
      toggle(true)
      toggleHasSidebar(true)
    } else {
      toggle(false)
      toggleHasSidebar(false)
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
      <DocsSideBar :project="{ id: openedProjectId }" />
    </template>
    <div v-if="isErrored">
      <DocsError />
    </div>
    <template v-else>
      <DocsPageView />
    </template>
  </NuxtLayout>
</template>
