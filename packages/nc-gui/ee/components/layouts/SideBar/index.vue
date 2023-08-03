<script lang="ts" setup>
import { toRef } from '@vue/runtime-core'
import type { NcProject } from '~~/lib'
import { useDashboardStore } from '~~/store/dashboard'

const props = defineProps<{
  project: NcProject
}>()

const project = toRef(props, 'project')

const dashboardStore = useDashboardStore()

const { layoutsOfProjects } = storeToRefs(dashboardStore)

const { openLayout } = dashboardStore

const layouts = computed(() => layoutsOfProjects.value[project.value.id!])
</script>

<template>
  <div class="border-none sortable-list">
    <LayoutsSideBarLayoutNode
      v-for="layout of layouts ?? []"
      :key="layout.id"
      v-e="['a:layout:open']"
      class="nc-tree-item text-sm cursor-pointer group"
      :data-order="layout.order"
      :data-id="layout.id"
      :data-testid="`tree-view-layout-${layout.title}`"
      :layout="layout"
      :project="project"
      @click="
        openLayout({
          layout,
          projectId: project.id!,
        })
      "
    >
    </LayoutsSideBarLayoutNode>
  </div>
</template>

<style lang="scss">
:deep(.ant-tree) {
  @apply !bg-transparent;
  background: transparent !important;
}

.dashboards-page-icon-change-popover {
  .ant-popover-inner {
    padding: 0 !important;
  }

  .ant-popover-inner-content {
    @apply !px-1.5 !py-1 text-xs text-white bg-black;
  }
}

.nc-dashboards-left-sidebar {
  .ant-tree-node-content-wrapper {
    min-width: 0 !important;
  }

  .ant-tree {
    // scrollbar reduce width and gray color
    overflow: overlay;

    &::-webkit-scrollbar {
      width: 4px;
    }

    /* Track */
    &::-webkit-scrollbar-track {
      background: #f6f6f600 !important;
    }

    /* Handle */
    &::-webkit-scrollbar-thumb {
      background: #f6f6f600;
    }

    /* Handle on hover */
    &::-webkit-scrollbar-thumb:hover {
      background: #f6f6f600;
    }
  }

  .ant-tree:hover {
    // scrollbar reduce width and gray color
    &::-webkit-scrollbar {
      width: 4px;
    }

    /* Track */
    &::-webkit-scrollbar-track {
      background: #f6f6f600 !important;
    }

    /* Handle */
    &::-webkit-scrollbar-thumb {
      background: rgb(234, 234, 234);
    }

    /* Handle on hover */
    &::-webkit-scrollbar-thumb:hover {
      background: rgb(203, 203, 203);
    }
  }

  .ant-tree-treenode {
    @apply w-full rounded-md mt-0.65 !important;
  }

  .ant-tree-node-content-wrapper {
    @apply w-full mr-2 pl-0.5 bg-inherit transition-none !important;
    transition: none !important;
  }

  .ant-tree-list {
    @apply pt-0.5 last: pb-1;

    .ant-tree-switcher {
      @apply mt-1 !important;
    }

    .ant-tree-switcher-icon {
      @apply !text-gray-300;
    }

    .ant-tree-treenode {
      @apply !hover: bg-gray-200;
      transition: none !important;
    }

    .ant-tree-treenode-selected {
      @apply !bg-primary-selected !hover: bg-primary-selected;
      transition: none !important;
    }

    .ant-tree-node-selected {
      transition: none !important;
      @apply !bg-primary-selected !hover: bg-primary-selected;
    }

    .ant-tree-indent-unit {
      @apply w-4 !important;
    }
  }

  .nc-dashboards-menu .ant-dropdown-menu-item {
    @apply p-0 !important;
  }
}
</style>
