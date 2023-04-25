<script lang="ts" setup>
import { ref } from 'vue'
import type { TreeProps } from 'ant-design-vue'
import type { AntTreeNodeDropEvent } from 'ant-design-vue/lib/tree'
import { Icon as IconifyIcon } from '@iconify/vue'
import type { ProjectType } from 'nocodb-sdk'
import { onMounted, toRef } from '@vue/runtime-core'

const props = defineProps<{
  project: ProjectType
}>()

const project = toRef(props, 'project')

const MAX_NESTED_LEVEL = 5

const { isPublic, openedPageInSidebar, nestedPagesOfProjects, isEditAllowed, openedTabsOfProjects } = storeToRefs(useDocStore())

const {
  fetchNestedPages,
  nestedUrl,
  deletePage,
  reorderPages,
  updatePage,
  addNewPage,
  expandTabOfOpenedPage,
  getChildrenOfPage,
  openChildPageTabsOfRootPages,
  openPage,
} = useDocStore()

const nestedPages = computed(() => nestedPagesOfProjects.value[project.value.id!])

const openedTabs = ref<string[]>([])

const deleteModalOpen = ref(false)
const selectedPageId = ref()

const onLoadData: TreeProps['loadData'] = async (treeNode) => {
  return new Promise((resolve) => {
    if (treeNode.dataRef?.children) {
      resolve()
    }
  })
}

const openPageTabKeys = computed({
  get: () => (openedPageInSidebar.value?.id ? [openedPageInSidebar.value?.id] : null),
  set: () => {},
})

const openDeleteModal = ({ pageId }: { pageId: string }) => {
  selectedPageId.value = pageId

  deleteModalOpen.value = true
}

const onDeletePage = async () => {
  await deletePage({ pageId: selectedPageId.value })

  selectedPageId.value = undefined
  deleteModalOpen.value = false
}

const onDragEnter = () => {
  // console.log(info)
}

const onDrop = async (info: AntTreeNodeDropEvent) => {
  if (info.dropPosition < 0) info.dropPosition = 0

  // Since `info.node.dataRef.parent_page_id` can be `null`, make `undefined` is converted to `null`
  if (!info.dragNode.dataRef!.parent_page_id) info.dragNode.dataRef!.parent_page_id = null

  if (info.dragNode.dataRef!.parent_page_id === info.node.dataRef!.parent_page_id) {
    const parentId: string | undefined = info.dragNode.dataRef!.parent_page_id
    const siblings: any[] = getChildrenOfPage({ pageId: parentId, projectId: project.value.id! })
    const targetNodeIndex = siblings.findIndex((node) => node.id === info.node.dataRef!.id)
    const dragNodeIndex = siblings.findIndex((node) => node.id === info.dragNode.dataRef!.id)

    if (dragNodeIndex < targetNodeIndex) {
      info.dropPosition = info.dropPosition - 1
    }
  }

  await reorderPages({
    sourceNodeId: info.dragNode.dataRef!.id!,
    targetNodeId: info.dropToGap ? info.node.dataRef!.parent_page_id : info.node.dataRef!.id,
    index: info.dropToGap ? info.dropPosition : 0,
    projectId: project.value.id!,
  })
}

const onTabSelect = (_: any, e: { selected: boolean; selectedNodes: any; node: any; event: any; nativeEvent: any }) => {
  if (!e.selected) return
  const eventBubblePath: any[] = e.nativeEvent?.path ?? []
  if (
    eventBubblePath.some((el: any) => {
      if (typeof el?.classList?.contains === 'function') {
        return el.classList.contains('nc-docs-sidebar-page-options')
      }

      return false
    })
  ) {
    return
  }

  openPage({
    page: e.node.dataRef,
    projectId: project.value.id!,
  })
}

const setIcon = async (id: string, icon: string) => {
  try {
    await updatePage({ pageId: id, page: { icon }, projectId: project.value.id! })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

watch(
  openedPageInSidebar,
  () => {
    if (!openedPageInSidebar.value) return

    expandTabOfOpenedPage({
      projectId: project.value.id!,
    })
  },
  {
    immediate: true,
  },
)

watch(
  () => openedTabsOfProjects.value[project.value.id!],
  (val) => {
    openedTabs.value = val ?? []
  },
  {
    immediate: true,
    deep: true,
  },
)

onKeyStroke('Enter', () => {
  if (deleteModalOpen.value) {
    onDeletePage()
  }
})

onMounted(async () => {
  if (isPublic.value) return

  await fetchNestedPages({ projectId: project.value.id! })

  await openChildPageTabsOfRootPages({
    projectId: project.value.id!,
  })
})
</script>

<template>
  <template v-if="nestedPages">
    <a-layout-sider
      :collapsed="false"
      collapsed-width="50"
      class="relative h-full z-1 nc-docs-left-sidebar !min-w-56.5 pb-1 !bg-inherit pl-2"
      :class="{
        'px-1 !min-w-61.5': isPublic,
        '!min-w-56.5': !isPublic,
      }"
      :data-testid="`docs-sidebar-${project.title}`"
      :trigger="null"
      collapsible
      theme="light"
    >
      <a-tree
        v-model:expanded-keys="openedTabs"
        v-model:selectedKeys="openPageTabKeys"
        :load-data="onLoadData"
        :tree-data="nestedPages"
        :draggable="isEditAllowed"
        :on-drop="onDrop"
        class="!w-full h-full overflow-y-scroll !overflow-x-hidden !bg-inherit"
        @dragenter="onDragEnter"
        @select="onTabSelect"
      >
        <template #title="{ title, id, icon, level }">
          <div
            class="flex flex-row items-center justify-between group pt-1"
            :data-testid="`docs-sidebar-page-${project.title}-${title}`"
            :data-level="level"
          >
            <div
              class="flex flex-row gap-x-1 text-ellipsis overflow-clip min-w-0 transition-all duration-200 ease-in-out"
              :class="{}"
            >
              <div class="flex flex-shrink-0">
                <a-popover
                  :visible="isEditAllowed ? undefined : false"
                  placement="bottom"
                  overlay-class-name="docs-page-icon-change-popover"
                  color="#000000"
                >
                  <template #content> Change Icon </template>
                  <a-dropdown placement="bottom" trigger="click" :disabled="!isEditAllowed">
                    <div
                      class="flex px-0.75 pt-0.75 text-gray-500 rounded-md"
                      :class="{
                        'hover:bg-gray-300 cursor-pointer': isEditAllowed,
                      }"
                      data-testid="docs-sidebar-emoji-selector"
                    >
                      <IconifyIcon
                        v-if="icon"
                        :key="icon"
                        :data-testid="`nc-doc-page-icon-${icon}`"
                        class="text-lg"
                        :icon="icon"
                      ></IconifyIcon>
                      <MdiFileDocumentOutline v-else />
                    </div>
                    <template #overlay>
                      <div class="flex flex-col p-1 bg-gray-50 rounded-md">
                        <GeneralEmojiIcons class="shadow p-2" @select-icon="setIcon(id, $event)" />
                      </div>
                    </template>
                  </a-dropdown>
                </a-popover>
              </div>
              <span
                class="text-ellipsis overflow-hidden nc-docs-sidebar-page-title"
                :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
              >
                {{ title }}
              </span>
            </div>
            <div v-if="isEditAllowed" class="flex flex-row justify-start items-center pl-2 gap-x-1 h-3">
              <a-dropdown placement="bottom" trigger="click">
                <div
                  class="nc-docs-sidebar-page-options flex px-0.5 hover:( !bg-gray-300 !bg-opacity-30 rounded-md) cursor-pointer select-none hidden group-hover:block"
                  data-testid="docs-sidebar-page-options"
                >
                  <MdiDotsHorizontal />
                </div>
                <template #overlay>
                  <div class="flex flex-col p-1 bg-gray-50 rounded-md w-28 gap-y-0.5 border-1 border-gray-100">
                    <div
                      class="flex items-center cursor-pointer select-none px-1.5 py-1.5 text-xs gap-x-2.5 hover:bg-gray-100 rounded-md !text-red-500"
                      data-testid="docs-sidebar-page-delete"
                      @click="() => openDeleteModal({ pageId: id })"
                    >
                      <MdiDeleteOutline class="h-3.5" />
                      <div class="flex font-semibold">Delete</div>
                    </div>
                  </div>
                  <a-menu>
                    <a-menu-item class="!py-2">
                      <div
                        class="flex flex-row items-center space-x-2 text-red-500"
                        @click="() => openDeleteModal({ pageId: id })"
                      >
                        <MdiDeleteOutline class="flex" />
                        <div class="flex">Delete</div>
                      </div>
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
              <div
                v-if="level < MAX_NESTED_LEVEL"
                class="nc-docs-add-child-page flex px-0.5 hover:( !bg-gray-300 !bg-opacity-30 rounded-md) cursor-pointer select-none hidden group-hover:block"
                @click="() => addNewPage({parentPageId: id, projectId: project.id!})"
              >
                <MdiPlus />
              </div>
            </div>
          </div>
        </template>
      </a-tree>
      <div
        v-if="isEditAllowed"
        class="py-1 flex flex-row pl-7 items-center gap-x-2 cursor-pointer hover:text-black text-gray-600 text-sm"
        data-testid="nc-docs-sidebar-add-page"
        @click="() => addNewPage({parentPageId: undefined, projectId: project.id!})"
      >
        <MdiPlus />
        <div class="flex">Create New Page</div>
      </div>
    </a-layout-sider>
    <a-modal v-model:visible="deleteModalOpen" centered :closable="false" :footer="false">
      <div class="flex flex-col ml-2">
        <div class="flex ml-1">Are you sure you want to delete this page?</div>
        <div class="flex flex-row mt-4 space-x-3">
          <a-button type="text" @click="deleteModalOpen = false">Cancel</a-button>
          <a-button type="danger" data-testid="docs-page-delete-confirmation" @click="onDeletePage">Delete</a-button>
        </div>
      </div>
    </a-modal>
  </template>
</template>

<style lang="scss">
:deep(.ant-tree) {
  @apply !bg-transparent;
  background: transparent !important;
}

.docs-page-icon-change-popover {
  .ant-popover-inner {
    padding: 0 !important;
  }
  .ant-popover-inner-content {
    @apply !px-1.5 !py-1 text-xs text-white bg-black;
  }
}

.nc-docs-left-sidebar {
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
    @apply pt-0.5 last:pb-1;
    .ant-tree-switcher {
      @apply mt-1 !important;
    }
    .ant-tree-switcher-icon {
      @apply !text-gray-300;
    }
    .ant-tree-treenode {
      @apply !hover:bg-gray-200;
      transition: none !important;
    }
    .ant-tree-treenode-selected {
      @apply !bg-primary-selected-sidebar !hover:bg-primary-selected-sidebar;
      transition: none !important;
    }
    .ant-tree-node-selected {
      transition: none !important;
      @apply !bg-primary-selected-sidebar !hover:bg-primary-selected-sidebar;
    }
    // .ant-tree-treenode-selected {
    //   @apply !bg-primary-selected-sidebar;
    // }
    .ant-tree-indent-unit {
      @apply w-4 !important;
    }
  }

  .nc-docs-menu .ant-dropdown-menu-item {
    @apply p-0 !important;
  }

  // .page-search {
  //   @apply !rounded-md !bg-gray-100;
  //   input.ant-input {
  //     @apply !bg-gray-100;
  //     // placeholder
  //     &::placeholder {
  //       @apply !text-black text-xs pl-1;
  //     }
  //   }
  // }
}
</style>
