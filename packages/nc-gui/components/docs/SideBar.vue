<script lang="ts" setup>
import { ref } from 'vue'
import type { TreeProps } from 'ant-design-vue'
import type { AntTreeNodeDropEvent } from 'ant-design-vue/lib/tree'

const isPublic = inject(IsDocsPublicInj, ref(false))

const { project } = useProject()
const {
  nestedPages,
  openedPage,
  openedTabs,
  nestedUrl,
  deletePage,
  reorderPages,
  openedBook,
  addNewPage,
  getChildrenOfPage,
  isOnlyBookOpened,
} = useDocs()

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
  get: () => [openedPage.value?.id],
  set: () => {},
})

const openDeleteModal = ({ pageId }: { pageId: string }) => {
  selectedPageId.value = pageId

  deleteModalOpen.value = true
}

const onDeletePage = async () => {
  await deletePage({ pageId: selectedPageId.value, bookId: openedBook.value!.id })

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
    const siblings: any[] = getChildrenOfPage(parentId)
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

  const id = e.node.dataRef!.id

  navigateTo(nestedUrl(id))
}

const navigateToOpenedBook = () => {
  navigateTo(nestedUrl(openedBook.value!.id!))
}
</script>

<template>
  <a-layout-sider
    :collapsed="false"
    width="250"
    collapsed-width="50"
    class="relative shadow-md h-full z-1 nc-docs-left-sidebar"
    :class="{ 'pb-14': !isPublic }"
    :trigger="null"
    collapsible
    theme="light"
  >
    <div
      v-if="!isPublic"
      class="flex flex-row justify-between items-center pr-2 pl-3 pb-3 pt-2.5 border-b-gray-100 border-b-1 hover:(bg-gray-100 cursor-pointer)"
      :class="{ 'bg-primary-selected hover:(!bg-primary-selected bg-opacity-20)': isOnlyBookOpened, '': !isOnlyBookOpened }"
      @click.self="navigateToOpenedBook"
    >
      <div
        class="flex flex-row text-xs font-semibold items-center gap-x-3"
        :class="{ 'text-primary': isOnlyBookOpened }"
        @click="navigateToOpenedBook"
      >
        <div class="flex">
          <MdiBookOpenOutline />
        </div>
        <div class="flex text-base">
          {{ project.title }}
        </div>
      </div>
      <div class="flex flex-row justify-between items-center">
        <div
          class="flex select-none p-1 rounded-md"
          :class="{
            'cursor-not-allowed !bg-gray-50 text-gray-400': !openedBook,
            'hover:(text-primary/100 !bg-gray-200 !bg-opacity-60) cursor-pointer': openedBook,
          }"
          @click="() => openedBook && addNewPage()"
        >
          <MdiPlus />
        </div>
      </div>
    </div>
    <div v-else class="flex"></div>
    <a-tree
      :key="openedBook?.id"
      v-model:expandedKeys="openedTabs"
      v-model:selectedKeys="openPageTabKeys"
      :load-data="onLoadData"
      :tree-data="(nestedPages as any)"
      :draggable="!isPublic"
      :on-drop="onDrop"
      show-icon
      class="!w-full h-full overflow-y-scroll overflow-x-hidden pb-20"
      @dragenter="onDragEnter"
      @select="onTabSelect"
    >
      <template #title="{ title, id }">
        <div class="flex flex-row items-center justify-between group pt-1">
          <div class="text-ellipsis overflow-clip min-w-0 transition-all duration-200 ease-in-out" :class="{}">
            <span
              class="text-ellipsis overflow-hidden"
              :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
            >
              {{ title }}
            </span>
          </div>
          <div v-if="!isPublic" class="flex flex-row justify-start items-center pl-2 gap-x-1">
            <a-dropdown placement="bottom" trigger="click">
              <div
                class="nc-docs-sidebar-page-options flex p-0.5 hover:( !bg-gray-300 !bg-opacity-30 rounded-md) cursor-pointer select-none hidden group-hover:block"
              >
                <MdiDotsHorizontal />
              </div>
              <template #overlay>
                <div class="flex flex-col p-1 bg-gray-50 rounded-md w-28 gap-y-0.5 border-1 border-gray-100">
                  <div
                    class="flex items-center cursor-pointer select-none px-1.5 py-1.5 text-xs gap-x-2.5 hover:bg-gray-100 rounded-md !text-red-500"
                    @click="() => openDeleteModal({ pageId: id })"
                  >
                    <MdiDeleteOutline class="h-3.5" />
                    <div class="flex font-semibold">Delete</div>
                  </div>
                </div>
                <a-menu>
                  <a-menu-item class="!py-2">
                    <div class="flex flex-row items-center space-x-2 text-red-500" @click="() => openDeleteModal({ pageId: id })">
                      <MdiDeleteOutline class="flex" />
                      <div class="flex">Delete</div>
                    </div>
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
            <div
              class="flex p-0.5 hover:( !bg-gray-300 !bg-opacity-30 rounded-md) cursor-pointer select-none hidden group-hover:block"
              @click="() => addNewPage(id)"
            >
              <MdiPlus />
            </div>
          </div>
        </div>
      </template>
    </a-tree>
  </a-layout-sider>
  <a-modal v-model:visible="deleteModalOpen" centered :closable="false" :footer="false">
    <div class="flex flex-col">
      <div class="flex">Are you sure you want to delete this page?</div>
      <div class="flex flex-row mt-4 space-x-3 ml-2">
        <a-button type="text" @click="deleteModalOpen = false">Cancel</a-button>
        <a-button type="danger" @click="onDeletePage">Delete</a-button>
      </div>
    </div>
  </a-modal>
</template>

<style lang="scss">
.nc-docs-left-sidebar {
  .ant-tree-node-content-wrapper {
    min-width: 0 !important;
  }
  .ant-tree-list-holder-inner {
    @apply mx-2.5;
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
    @apply w-full rounded-md mt-0.5 !important;
  }
  .ant-tree-node-content-wrapper {
    @apply w-full mr-2 pl-0.5 !important;
  }
  .ant-tree-list {
    @apply pt-0.5 last:pb-3;
    .ant-tree-switcher {
      @apply mt-1 !important;
    }
    .ant-tree-switcher-icon {
      @apply !text-gray-300;
    }
    .ant-tree-treenode {
      @apply !bg-white !hover:bg-gray-100;
      transition: all 0.3s, border 0s, line-height 0s, box-shadow 0s;
      transition-duration: 0.3s, 0s, 0s, 0s;
      transition-timing-function: ease, ease, ease, ease;
      transition-delay: 0s, 0s, 0s, 0s;
      transition-property: all, border, line-height, box-shadow;
    }
    .ant-tree-treenode-selected {
      @apply !bg-primary-selected !hover:bg-primary-selected;
      transition: all 0.3s, border 0s, line-height 0s, box-shadow 0s;
      transition-duration: 0.3s, 0s, 0s, 0s;
      transition-timing-function: ease, ease, ease, ease;
      transition-delay: 0s, 0s, 0s, 0s;
      transition-property: all, border, line-height, box-shadow;
    }
    .ant-tree-node-selected {
      @apply !bg-primary-selected !hover:bg-primary-selected;
    }
    // .ant-tree-treenode-selected {
    //   @apply !bg-primary-selected;
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
