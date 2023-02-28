<script setup lang="ts">
definePageMeta({
  key: 'true',
  hideHeader: true,
  layout: 'docs',
  public: true,
})

const isPublic = ref(false)
provide(IsDocsPublicInj, isPublic)

const { project, loadBookProject, isLoading } = useProject()
const isLoadingProject = ref(true)

onMounted(async () => {
  isLoadingProject.value = true
  if (!project.value.id && !isLoading.value) {
    await loadBookProject()
    if (project.value.isPublicView) {
      isPublic.value = true
    }
  }
  isLoadingProject.value = false
})
</script>

<template>
  <DocsView v-if="!isLoadingProject" :key="project?.id" />
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
