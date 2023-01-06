<script lang="ts" setup>
import type { Ref } from 'vue'
import { ref } from 'vue'
import type { TreeProps } from 'ant-design-vue'
import type { AntTreeNodeDropEvent } from 'ant-design-vue/lib/tree'

const isPublic = inject(IsDocsPublicInj, ref(false))

const { project } = useProject()
const {
  fetchPages,
  pages,
  books,
  createMagic,
  createImport,
  openedPage,
  openedTabs,
  nestedUrl,
  deletePage,
  reorderPages,
  openedBook,
  addNewPage,
  fetchBooks,
  navigateToLastBook,
  getChildrenOfPage,
} = useDocs()

const deleteModalOpen = ref(false)
const selectedPageId = ref()

const magicModalOpen = ref(false)
const magicFormData = ref({
  title: '',
  content: '',
})
const magicParentPageId = ref()
const isMagicLoading = ref(false)

const importModalOpen = ref(false)
const importFormData = ref({
  title: '',
  content: '',
})
const isImporting = ref(false)
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

const onMagic = async () => {
  isMagicLoading.value = true
  try {
    await createMagic(magicFormData.value.title)
    await fetchBooks()
    await navigateToLastBook()
  } catch (e) {
    console.error(e)
  } finally {
    magicModalOpen.value = false
    isMagicLoading.value = false
  }
}

const onImport = async () => {
  isImporting.value = true
  try {
    await createImport(importFormData.value.title, 'nuxt')
    await fetchBooks()
    await navigateToLastBook()
  } catch (e) {
    console.error(e)
  } finally {
    importModalOpen.value = false
    isImporting.value = false
  }
}

const openMagicModal = (parentId?: string | undefined) => {
  magicParentPageId.value = parentId
  magicModalOpen.value = true
}

const openImportModal = () => {
  importType.value = null
  importModalOpen.value = true
}

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
    <div v-if="!isPublic" class="flex text-xs font-semibold text-gray-600 px-2 ml-2 py-3">DOCUMENT PAGES</div>
    <div v-if="!isPublic" class="flex px-3">
      <a-input class="page-search" placeholder="Search">
        <template #prefix>
          <MdiMagnify />
        </template>
      </a-input>
    </div>
    <div
      v-if="!isPublic"
      class="py-1.5 mt-3 mb-2 flex flex-row justify-between items-center mx-3 pr-2 pl-3 rounded-md bg-violet-50"
    >
      <div class="flex text-xs font-semibold" style="color: #1c26b8">{{ project.title }}</div>
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
        <a-dropdown overlay-class-name="nc-docs-menu" trigger="click">
          <div
            class="flex hover:(text-primary/100 !bg-gray-200 !bg-opacity-60 rounded-md) cursor-pointer select-none p-1"
            @click.prevent
          >
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
  <a-modal
    :visible="magicModalOpen"
    :closable="false"
    :cancel-button-props="{ disabled: isMagicLoading }"
    :mask-closable="false"
    :confirm-loading="isMagicLoading"
    @cancel="magicModalOpen = false"
    @ok="onMagic"
  >
    <template #title>
      <div class="flex items-center">
        Create
        <PhSparkleFill :class="{ 'nc-animation-pulse': isMagicLoading }" class="ml-2 text-orange-400" />
      </div>
    </template>
    <a-form :model="magicFormData">
      <a-form-item label="Title">
        <a-input v-model:value="magicFormData.title" />
      </a-form-item>
    </a-form>
  </a-modal>
  <a-modal
    :visible="importModalOpen"
    :closable="false"
    :mask-closable="false"
    :cancel-button-props="{ disabled: isMagicLoading }"
    :confirm-loading="isImporting"
    @cancel="importModalOpen = false"
    @ok="onImport"
  >
    <template #title>
      <div class="flex items-center">
        Import documentation
        <PhUploadSimpleFill :class="{ 'nc-animation-pulse': isImporting }" class="ml-2 text-blue-400" />
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

  .page-search {
    @apply !rounded-md !bg-gray-100;
    input.ant-input {
      @apply !bg-gray-100;
      // placeholder
      &::placeholder {
        @apply !text-black text-xs pl-1;
      }
    }
  }
}
</style>
