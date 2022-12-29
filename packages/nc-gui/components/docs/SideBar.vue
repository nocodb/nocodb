<script lang="ts" setup>
import type { Ref } from 'vue'
import { ref } from 'vue'
import type { TreeProps } from 'ant-design-vue'
import type { AntTreeNodeDropEvent } from 'ant-design-vue/lib/tree'

const {
  fetchPages,
  pages,
  books,
  createPage,
  createBook,
  createMagic,
  createImport,
  openedPage,
  openedTabs,
  nestedUrl,
  deletePage,
  deleteBook,
  reorderPages,
  openedBook,
  selectBook,
  addNewPage,
  fetchBooks,
  navigateToLastBook,
  getChildrenOfPage,
} = useDocs()

const createModalOpen = ref(false)
const deleteModalOpen = ref(false)
const modalFormData = ref({
  title: '',
})

const selectedPageId = ref()
const selectedBookId = ref()
const isSelectedPage = ref(false)

const magicModalOpen = ref(false)
const magicFormData = ref({
  title: '',
  content: '',
})
const magicParentPageId = ref()
const loadMagic = ref(false)

const importModalOpen = ref(false)
const importFormData = ref({
  title: '',
  content: '',
})
const loadImport = ref(false)
const importType: Ref<'nuxt' | 'md' | 'docusaurus' | 'vitepress' | null> = ref(null)

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

const onOk = async () => {
  if (isSelectedPage.value) {
    await createPage({
      page: { ...modalFormData.value, parent_page_id: selectedPageId.value } as any,
      bookId: openedBook.value!.id!,
    })
  } else {
    await createBook({ book: { ...modalFormData.value } })
  }
  createModalOpen.value = false
}

const onMagic = async () => {
  loadMagic.value = true
  await createMagic(magicFormData.value.title)
  await fetchBooks()
  await navigateToLastBook()
  magicModalOpen.value = false
  loadMagic.value = false
}

const onImport = async () => {
  loadImport.value = true
  await createImport(importFormData.value.title, 'nuxt')
  await fetchBooks()
  await navigateToLastBook()
  importModalOpen.value = false
  loadImport.value = false
}

const openCreateBookOrPage = ({ parentId, isBook }: { parentId?: string | undefined; isBook: boolean }) => {
  if (isBook) {
    selectedBookId.value = undefined
    selectedPageId.value = undefined
    isSelectedPage.value = false
  } else {
    selectedBookId.value = openedBook.value?.id
    selectedPageId.value = parentId
    isSelectedPage.value = true
  }

  createModalOpen.value = true
  // addNewPage(parentId)
}

const openMagicModal = (parentId?: string | undefined) => {
  magicParentPageId.value = parentId
  magicModalOpen.value = true
}

const openImportModal = () => {
  importType.value = null
  importModalOpen.value = true
}

const openDeleteModal = ({ pageId, bookId, isBook }: { pageId: string; bookId: string; isBook: boolean }) => {
  if (isBook) {
    selectedBookId.value = bookId
    selectedPageId.value = undefined
  } else {
    selectedBookId.value = bookId
    selectedPageId.value = pageId
  }
  deleteModalOpen.value = true
}

const onDeletePage = async () => {
  if (selectedPageId.value) {
    await deletePage({ pageId: selectedPageId.value, bookId: selectedBookId.value })
  } else {
    await deleteBook({ id: selectedBookId.value })
  }
  selectedBookId.value = undefined
  selectedPageId.value = undefined

  deleteModalOpen.value = false
}

const onDragEnter = () => {
  // console.log(info)
}

const onDrop = async (info: AntTreeNodeDropEvent) => {
  if (info.dropPosition < 0) info.dropPosition = 0

  // if drag node and drop node are in the same parent and using `==` since `info.node.dataRef.parent_page_id` can be `null`
  if (info.dragNode.dataRef.parent_page_id == info.node.dataRef.parent_page_id) {
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
    console.log(e.node.dataRef, nestedUrl(id))

    navigateTo(nestedUrl(id))
  }
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
    <div class="py-2.5 flex flex-row justify-between items-center ml-2 px-2 border-b-warm-gray-100 border-b-1">
      <a-dropdown trigger="click">
        <div
          class="hover: cursor-pointer hover:bg-gray-100 pl-4 pr-2 py-1 rounded-md bg-gray-50 flex flex-row w-full mr-8 justify-between items-center"
        >
          <div class="flex font-semibold">
            {{ openedBook?.title }}
          </div>
          <MdiMenuDown />
        </div>
        <template #overlay>
          <a-menu>
            <a-menu-item class="!py-2" @click="() => openCreateBookOrPage({ isBook: true })"> Create new book </a-menu-item>
            <a-menu-item v-for="book in books" :key="book.id" class="!py-2" @click="() => selectBook(book)">
              {{ book.title }}
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
      <div class="flex flex-row justify-between items-center">
        <div
          class="flex select-none p-1 border-gray-100 border-1 rounded-md mr-1"
          :class="{
            'cursor-not-allowed !bg-gray-50 text-gray-400': !openedBook,
            'hover:(text-primary/100 !bg-blue-50) cursor-pointer': openedBook,
          }"
          @click="() => openedBook && addNewPage()"
        >
          <MdiPlus />
        </div>
        <a-dropdown overlay-class-name="nc-docs-menu" trigger="click">
          <div class="flex hover:(text-primary/100 !bg-blue-50 rounded-md) cursor-pointer select-none p-1" @click.prevent>
            <MdiDotsVertical />
          </div>
          <template #overlay>
            <a-menu>
              <a-menu-item>
                <div
                  class="flex items-center hover:(text-primary/100 !bg-blue-50) cursor-pointer select-none px-4 py-2"
                  @click="() => openImportModal()"
                >
                  <PhUploadSimpleFill class="text-blue-400 mr-2" />
                  Import
                </div>
              </a-menu-item>
              <a-menu-item>
                <div
                  class="flex items-center hover:(text-primary/100 !bg-blue-50) cursor-pointer select-none px-4 py-2"
                  @click="() => openMagicModal()"
                >
                  <PhSparkleFill class="text-orange-400 mr-2" />
                  Create Docs
                </div>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </div>
    <a-tree
      :key="openedBook?.id"
      v-model:expandedKeys="openedTabs"
      v-model:selectedKeys="openPageTabKeys"
      :load-data="onLoadData"
      :tree-data="pages"
      draggable
      :on-drop="onDrop"
      show-icon
      class="h-full overflow-auto pb-20"
      @dragenter="onDragEnter"
      @select="onTabSelect"
    >
      <template #title="{ title, id, book_id, parent_page_id }">
        <div class="flex flex-row w-full items-center justify-between group pt-1">
          <div class="flex" :class="{ 'font-semibold': !parent_page_id }">
            {{ title }}
          </div>
          <div class="flex flex-row justify-between items-center">
            <div
              class="flex hover:(text-primary/100) cursor-pointer select-none invisible group-hover:visible mr-2"
              @click="() => addNewPage(id)"
            >
              <MdiPlus />
            </div>
            <a-dropdown placement="bottomRight" trigger="click">
              <div
                class="flex hover:(text-primary/100 !bg-blue-50 rounded-md) cursor-pointer select-none invisible group-hover:visible"
              >
                <MdiDotsVertical />
              </div>
              <template #overlay>
                <a-menu>
                  <a-menu-item class="!py-2">
                    <div
                      class="flex flex-row items-center space-x-2 text-red-500"
                      @click="
                        () =>
                          openDeleteModal({ pageId: book_id ? id : undefined, bookId: book_id ? book_id : id, isBook: !book_id })
                      "
                    >
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
  <a-modal
    :visible="createModalOpen"
    :title="isSelectedPage ? 'Create Page' : 'Create book'"
    :closable="false"
    :mask-closable="false"
    @cancel="createModalOpen = false"
    @ok="onOk"
  >
    <a-form :model="modalFormData">
      <a-form-item label="Title">
        <a-input v-model:value="modalFormData.title" />
      </a-form-item>
    </a-form>
  </a-modal>
  <a-modal :visible="magicModalOpen" :closable="false" :mask-closable="false" @cancel="magicModalOpen = false" @ok="onMagic">
    <template #title>
      <div class="flex items-center">
        Create
        <PhSparkleFill :class="{ 'nc-animation-pulse': loadMagic }" class="ml-2 text-orange-400" />
      </div>
    </template>
    <a-form :model="magicFormData">
      <a-form-item label="Title">
        <a-input v-model:value="magicFormData.title" />
      </a-form-item>
    </a-form>
  </a-modal>
  <a-modal :visible="importModalOpen" :closable="false" :mask-closable="false" @cancel="importModalOpen = false" @ok="onImport">
    <template #title>
      <div class="flex items-center">
        Import documentation
        <PhUploadSimpleFill :class="{ 'nc-animation-pulse': loadMagic }" class="ml-2 text-blue-400" />
      </div>
    </template>
    <div v-if="importType === null">
      <a-card :bordered="false">
        <a-card-grid style="width: 25%; text-align: center; margin: 5px 4%" @click="importType = 'nuxt'">
          <LogosNuxtIcon class="text-5xl" />
        </a-card-grid>
        <a-card-grid style="width: 25%; text-align: center; margin: 5px 4%" @click="importType = 'nuxt'">
          <LogosDocusaurus class="text-5xl" />
        </a-card-grid>
        <a-card-grid style="width: 25%; text-align: center; margin: 5px 4%" @click="importType = 'nuxt'">
          <LogosVitejs class="text-5xl" />
        </a-card-grid>
        <a-card-grid style="width: 25%; text-align: center; margin: 5px 4%" @click="importType = 'nuxt'">
          <LogosConfluence class="text-5xl" />
        </a-card-grid>
        <a-card-grid style="width: 25%; text-align: center; margin: 5px 4%" @click="importType = 'nuxt'">
          <SimpleIconsGitbook class="text-5xl" />
        </a-card-grid>
        <a-card-grid style="width: 25%; text-align: center; margin: 5px 4%" @click="importType = 'nuxt'">
          <SimpleIconsNotion class="text-5xl" />
        </a-card-grid>
      </a-card>
    </div>
    <a-form v-else :model="importFormData">
      <a-form-item label="Url">
        <a-input v-model:value="importFormData.title" />
      </a-form-item>
    </a-form>
  </a-modal>
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
}
</style>
