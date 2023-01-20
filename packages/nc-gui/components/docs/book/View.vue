<script lang="ts" setup>
import dayjs from 'dayjs'
import type { Ref } from 'vue'
// import InfiniteLoading from 'v3-infinite-loading'
import MdiFileDocumentOutline from '~icons/mdi/file-document-outline'
import MdiFilterVariant from '~icons/mdi/filter-variant'
import type { PageSidebarNode } from '~~/composables/docs/useDocs'
const { project } = useProject()
const {
  openedBook,
  books,
  selectBook,
  createBook,
  createMagic,
  fetchBooks,
  navigateToLastBook,
  addNewPage,
  createImport,
  flattenedNestedPages,
  // fetchAllPages,
  // allPages,
  // allByTitle,
  openPage,
  // fetchPublishedPages,
  // fetchAllPagesByTitle,
  isOnlyBookOpened,
} = useDocs()

const showPublishModal = ref(false)

const showCreateBookModal = ref(false)
const bookFormModelData = ref({
  title: '',
})

const activeTabKey = ref('all')
const activeTabPagination = ref(1)
const tabInfo = [
  {
    title: 'All Pages',
    key: 'all',
    icon: () => MdiFileDocumentOutline,
  },
  // {
  //   title: 'Published',
  //   key: 'published',
  //   icon: () => MdiPublish,
  // },
  // {
  //   title: 'Unpublished',
  //   key: 'unpublished',
  //   icon: () => MdiFileEditOutline,
  // },
  {
    title: 'A-Z',
    key: 'allByTitle',
    icon: () => MdiFilterVariant,
  },
]

const flattenedNestedPagesByUpdatedAt = ref<PageSidebarNode[]>([])
watch(
  flattenedNestedPages,
  () => {
    flattenedNestedPagesByUpdatedAt.value = JSON.parse(JSON.stringify(flattenedNestedPages.value)).sort((a: any, b: any) => {
      return dayjs(b.updated_at).unix() - dayjs(a.updated_at).unix()
    })
  },
  {
    deep: true,
    immediate: true,
  },
)

const flattenedNestedPagesByTitle = ref<PageSidebarNode[]>([])
watch(
  flattenedNestedPages,
  () => {
    flattenedNestedPagesByTitle.value = JSON.parse(JSON.stringify(flattenedNestedPages.value)).sort((a: any, b: any) =>
      a.title!.localeCompare(b.title!),
    )
  },
  {
    deep: true,
    immediate: true,
  },
)

const isPagesFetching = ref(false)
const pages = computed(() => {
  switch (activeTabKey.value) {
    case 'all':
      return flattenedNestedPagesByUpdatedAt.value
    case 'allByTitle':
      return flattenedNestedPagesByTitle.value
    // case 'published':
    //   return publishedPages.value
    // case 'unpublished':
    //   return drafts.value
    default:
      return flattenedNestedPages.value
  }
})

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

const onCreateBook = async () => {
  await createBook({ book: { ...bookFormModelData.value } })
  showCreateBookModal.value = false
}

const openMagicModal = (parentId?: string | undefined) => {
  magicParentPageId.value = parentId
  magicModalOpen.value = true
}

const openImportModal = () => {
  importType.value = null
  importModalOpen.value = true
}

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

// watch(isOnlyBookOpened, async () => {
//   if (!isOnlyBookOpened.value) return
//   isPagesFetching.value = true
//   activeTabPagination.value = 1
//   activeTabKey.value = 'all'

//   await fetchAllPages({
//     pageNumber: activeTabPagination.value,
//     clear: true,
//   })
// })

// watch(
//   activeTabKey,
//   async (key) => {
//     isPagesFetching.value = true
//     activeTabPagination.value = 1
//     try {
//       if (key === 'all') {
//         await fetchAllPages({
//           pageNumber: activeTabPagination.value,
//           clear: true,
//         })
//       } else if (key === 'allByTitle') {
//         await fetchAllPagesByTitle({
//           pageNumber: activeTabPagination.value,
//           clear: true,
//         })
//       }
//       else if (key === 'published') {
//         await fetchPublishedPages({
//           pageNumber: activeTabPagination.value,
//           clear: true,
//         })
//       } else if (key === 'unpublished') {
//         await fetchDrafts()
//       }
//     } finally {
//       isPagesFetching.value = false
//     }
//   },
//   {
//     immediate: true,
//   },
// )

const loadListData = async ($state: any) => {
  $state.complete()
  // if (activeTabKey.value === 'unpublished') {
  //   return
  // }

  // $state.loading()
  // const oldPagesCount = pages.value?.length || 0

  // activeTabPagination.value += 1
  // switch (activeTabKey.value) {
  //   case 'all':
  //     await fetchAllPages({
  //       pageNumber: activeTabPagination.value,
  //     })
  //     break
  //   case 'allByTitle':
  //     await fetchAllPagesByTitle({
  //       pageNumber: activeTabPagination.value,
  //     })
  //     break
  //   case 'published':
  //     await fetchPublishedPages({
  //       pageNumber: activeTabPagination.value,
  //     })
  //     break
  //   default:
  //     break
  // }

  // if (pages.value?.length === oldPagesCount) {
  //   $state.complete()
  //   return
  // }
  // $state.loaded()
}
</script>

<template>
  <a-layout-content>
    <div class="flex flex-col mx-20 mt-10.5 px-6">
      <div class="flex flex-col h-28">
        <div class="flex flex-row justify-between items-center">
          <div class="flex flex-row gap-x-2 items-center ml-2">
            <div class="flex underline cursor-pointer">
              {{ openedBook?.title }}
            </div>
            <div class="flex text-gray-400">/</div>
          </div>
          <div class="flex flex-row items-center">
            <a-dropdown trigger="click">
              <div
                class="hover: cursor-pointer hover:bg-gray-100 pl-4 pr-2 py-1.5 rounded-md bg-gray-50 flex flex-row w-full mr-4 justify-between items-center"
              >
                <div class="flex font-semibold">
                  {{ openedBook?.title }}
                </div>
                <MdiMenuDown />
              </div>
              <template #overlay>
                <a-menu>
                  <a-menu-item class="!py-2" @click="showCreateBookModal = true"> Create new book </a-menu-item>
                  <a-menu-item v-for="book in books" :key="book.id" class="!py-2" @click="() => selectBook(book)">
                    {{ book.title }}
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
            <!-- <a-button type="primary" :disabled="!haveDrafts" :loading="isBulkPublishing" @click="showPublishModal = true">
              Publish v{{ openedBook?.order }}</a-button
            > -->
          </div>
        </div>
        <div class="flex flex-row justify-between mt-8 items-center">
          <div class="flex flex-row gap-x-6 items-center">
            <div class="flex text-4xl font-semibold">{{ project?.title }}</div>
            <a-dropdown overlay-class-name="nc-docs-menu" trigger="click">
              <div
                class="flex !bg-gray-50 rounded-md hover:( !bg-gray-200 !bg-opacity-60) cursor-pointer select-none p-1.5 mt-1.5"
                @click.prevent
              >
                <MdiDotsVertical />
              </div>
              <template #overlay>
                <a-menu>
                  <a-menu-item>
                    <div class="flex items-center cursor-pointer select-none px-1.5 py-2" @click="() => openImportModal()">
                      <PhUploadSimpleFill class="text-blue-400 mr-2" />
                      Import
                    </div>
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
          <div class="flex flex-row gap-x-2">
            <a-button type="text" class="!px-2 !border-1 !border-gray-100 !rounded-md" @click="() => addNewPage()">
              <div class="flex flex-row gap-x-1 items-center">
                <div class="flex pl-1">New Page</div>
                <MdiPlus />
              </div>
            </a-button>
            <a-button type="text" class="!px-2 !border-1 !border-gray-100 !rounded-md" @click="() => openMagicModal()">
              <div class="flex flex-row gap-x-1 items-center">
                <div class="flex pl-1">Create Pages with</div>
                <PhSparkleFill class="text-orange-400 h-3.5" />
              </div>
            </a-button>
          </div>
        </div>
      </div>
      <div class="flex flex-row w-full mt-10 !overflow-y-hidden docs-book-list-container h-[calc(100vh-16rem)]">
        <a-tabs v-model:activeKey="activeTabKey" class="!w-full !overflow-y-hidden">
          <a-tab-pane v-for="tab of tabInfo" :key="tab.key">
            <template #tab>
              <div class="flex flex-row items-center text-xs px-2">
                <component :is="tab.icon()" class="mr-2" />
                <div>
                  {{ tab.title }}
                </div>
              </div>
            </template>
            <!-- <div v-if="isPagesFetching">
              <div class="flex flex-col mt-36">
                <a-spin size="large" />
              </div>
            </div> -->
            <div :key="activeTabKey" class="h-full overflow-y-auto docs-book-infinite-list">
              <div class="flex flex-col gap-y-4 mt-6 mb-12 px-2">
                <div
                  v-for="(page, index) of pages"
                  :key="index"
                  class="flex cursor-pointer px-5 mx-1 py-3 rounded-md border-gray-50 border-1 hover:bg-gray-50 shadow-gray-50 shadow-sm"
                  @click="() => openPage(page)"
                >
                  <div class="flex flex-col gap-y-2">
                    <div style="font-weight: 450; font-size: 0.9rem">
                      {{ page?.title }}
                    </div>

                    <div class="flex text-gray-400" style="font-weight: 300; font-size: 0.7rem">
                      Updated {{ dayjs(page!.updated_at!).local().fromNow() }}
                    </div>
                  </div>
                </div>
                <!-- <InfiniteLoading v-bind="$attrs" @infinite="loadListData">
                  <template #spinner>
                    <div class="flex flex-row w-full justify-center mt-2">
                      <a-spin />
                    </div>
                  </template>
                  <template #complete>
                    <span></span>
                  </template>
                </InfiniteLoading> -->
              </div>
            </div>
          </a-tab-pane>
        </a-tabs>
      </div>
    </div>
    <DocsBookPublishModal :model-value="showPublishModal" @update:model-value="showPublishModal = $event" />
    <a-modal
      :visible="showCreateBookModal"
      title="Create book"
      :closable="false"
      :mask-closable="false"
      @cancel="showCreateBookModal = false"
      @ok="onCreateBook"
    >
      <a-form :model="bookFormModelData">
        <a-form-item label="Title">
          <a-input v-model:value="bookFormModelData.title" />
        </a-form-item>
      </a-form>
    </a-modal>
    <a-modal
      :visible="magicModalOpen"
      :closable="false"
      :cancel-button-props="{ disabled: isMagicLoading }"
      :mask-closable="false"
      :confirm-loading="isMagicLoading"
      ok-text="Submit"
      @cancel="magicModalOpen = false"
      @ok="onMagic"
    >
      <template #title>
        <div class="flex items-center">
          Create Pages
          <PhSparkleFill :class="{ 'nc-animation-pulse': isMagicLoading }" class="ml-2 text-orange-400" />
        </div>
      </template>
      <a-form :model="magicFormData">
        <div class="flex flex-col mx-2">
          <div class="ml-1 mb-2 text-sm">
            Title representing your need <span class="text-gray-500">(i.e Marketing handbook) </span>:
          </div>
          <a-form-item>
            <a-input v-model:value="magicFormData.title" class="!rounder-md" />
          </a-form-item>
        </div>
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
  </a-layout-content>
</template>

<style lang="scss">
.docs-book-list-container > .ant-tabs > .ant-tabs-content-holder > .ant-tabs-content {
  @apply h-full;
}
.docs-book-list-container .ant-tabs-nav {
  @apply mb-0 !important;
}
.docs-book-list-container .ant-tabs-nav-list {
  @apply ml-0 !important;
}
.docs-book-list-container .ant-tabs-tab {
  @apply px-3 ml-0;
}
.docs-book-infinite-list {
  &::-webkit-scrollbar {
    width: 4px;
  }

  /* Track */
  &::-webkit-scrollbar-track {
    background: #f6f6f6 !important;
  }

  /* Handle */
  &::-webkit-scrollbar-thumb {
    background: rgb(228, 228, 228);
  }

  /* Handle on hover */
  &::-webkit-scrollbar-thumb:hover {
    background: rgb(194, 194, 194);
  }
}
</style>
