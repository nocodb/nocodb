<script setup lang="ts">
definePageMeta({
  key: 'true',
  hideHeader: true,
  layout: 'docs',
  public: true,
  requiresAuth: false,
})

const { setProject, project } = useProject()
const { isOpen: isSidebarOpen, toggleHasSidebar, toggle } = useSidebar('nc-left-sidebar')

const route = useRoute()

const { isErrored, openedProjectId, isNestedPublicPage } = storeToRefs(useDocStore())

const { fetchNestedPages } = useDocStore()

const isFetching = ref(true)

onMounted(async () => {
  isFetching.value = true

  setProject({ id: openedProjectId.value })
  await fetchNestedPages({
    projectId: openedProjectId.value as string,
  })

  isFetching.value = false
})

watch(isNestedPublicPage, (val) => {
  if (val) {
    toggleHasSidebar(true)
    toggle(true)
  } else {
    toggleHasSidebar(false)
    toggle(false)
  }
})
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
