<script lang="ts" setup>
import { ref } from 'vue'
import type { TreeProps } from 'ant-design-vue'
import type { AntTreeNodeDropEvent } from 'ant-design-vue/lib/tree'

const isPublic = inject(IsDocsPublicInj, ref(false))

const { project } = useProject()
const {
  fetchPages,
  pages,
  books,
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
      return
    }

    fetchPages({
      parentPageId: treeNode.dataRef?.id,
      book: books.value.find((book) => book.id === treeNode.dataRef?.book_id)!,
    }).then(() => {
      resolve()
    })
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

const onTabSelect = (_: any, e: { selected: boolean; selectedNodes: any; node: any; event: any }) => {
  if (e.selected) {
    const id = e.node.dataRef!.id

    navigateTo(nestedUrl(id))
  }
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
    class="relative shadow-md h-full z-1 nc-docs-left-sidebar pb-12"
    :trigger="null"
    collapsible
    theme="light"
  >
    <div
      v-if="!isPublic"
      class="py-1.5 mt-3 mb-2 flex flex-row justify-between items-center mx-3 pr-2 pl-3 rounded-md hover:(bg-gray-100 cursor-pointer)"
      :class="{ 'bg-violet-50 hover:(!bg-violet-50 bg-opacity-20)': isOnlyBookOpened, 'bg-gray-50': !isOnlyBookOpened }"
      @click.self="navigateToOpenedBook"
    >
      <div class="flex text-xs font-semibold" :class="{ 'text-primary': isOnlyBookOpened }">
        {{ project.title }}
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
    <div v-else class="flex py-0.5"></div>
    <a-tree
      :key="openedBook?.id"
      v-model:expandedKeys="openedTabs"
      v-model:selectedKeys="openPageTabKeys"
      :load-data="onLoadData"
      :tree-data="pages"
      :draggable="!isPublic"
      :on-drop="onDrop"
      show-icon
      class="h-full overflow-auto pb-20"
      @dragenter="onDragEnter"
      @select="onTabSelect"
    >
      <template #title="{ title, id }">
        <div class="flex flex-row w-full items-center justify-between group pt-1">
          <div class="flex">
            {{ title }}
          </div>
          <div v-if="!isPublic" class="flex flex-row justify-between items-center">
            <div
              class="flex p-0.5 hover:(text-primary/100 !bg-gray-300 !bg-opacity-30 rounded-md) cursor-pointer select-none invisible group-hover:visible mr-2"
              @click="() => addNewPage(id)"
            >
              <MdiPlus />
            </div>
            <a-dropdown placement="bottomRight" trigger="click">
              <div
                class="flex p-0.5 hover:(text-primary/100 !bg-gray-300 !bg-opacity-30 rounded-md) cursor-pointer select-none invisible group-hover:visible"
              >
                <MdiDotsVertical />
              </div>
              <template #overlay>
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
  .ant-tree-treenode {
    @apply w-full !important;
  }
  .ant-tree-node-content-wrapper {
    @apply w-full mr-2 pl-0.5 !important;
  }
  .ant-tree-list {
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
    .ant-tree-treenode.ant-tree-treenode-selected {
      @apply !bg-blue-50 !hover:bg-blue-50;
      transition: all 0.3s, border 0s, line-height 0s, box-shadow 0s;
      transition-duration: 0.3s, 0s, 0s, 0s;
      transition-timing-function: ease, ease, ease, ease;
      transition-delay: 0s, 0s, 0s, 0s;
      transition-property: all, border, line-height, box-shadow;
    }
    .ant-tree-node-selected {
      @apply !bg-blue-50 !hover:bg-blue-50;
    }
    .ant-tree-treenode-selected {
      @apply !bg-blue-50;
    }
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
