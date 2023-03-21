<script setup lang="ts">
definePageMeta({
  key: 'true',
  hideHeader: true,
  layout: 'docs',
  public: true,
  requiresAuth: false,
})

const { setProject } = useProject()
const { isOpen: isSidebarOpen, toggleHasSidebar, toggle } = useSidebar('nc-left-sidebar')

const route = useRoute()

const { isErrored, isFetching, openedProjectId } = storeToRefs(useDocStore())

const { fetchNestedPages } = useDocStore()

onMounted(() => {
  setProject({ id: openedProjectId.value })
  fetchNestedPages({
    projectId: openedProjectId.value as string,
  })
})
</script>

<template>
  <NuxtLayout id="content" :key="route.params.projectId as string" class="flex">
    <template v-if="isSidebarOpen" #sidebar>
      <DocsSideBar :project="{}" />
    </template>
    <div v-if="isErrored">
      <DocsError />
    </div>
    <template v-else>
      <DocsPageView />
    </template>
  </NuxtLayout>
</template>
