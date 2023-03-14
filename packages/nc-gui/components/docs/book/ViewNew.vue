<script lang="ts" setup>
import dayjs from 'dayjs'
import type { Ref } from 'vue'
// import InfiniteLoading from 'v3-infinite-loading'
import { Loading3QuartersOutlined } from '@ant-design/icons-vue'
import MdiFileDocumentOutline from '~icons/mdi/file-document-outline'
import MdiFilterVariant from '~icons/mdi/filter-variant'
import type { PageSidebarNode } from '~composables/docs/useDocs'
import {storeToRefs} from "pinia";
import {useProject} from '#imports'
import {onMounted} from "@vue/runtime-core";

const { project } = storeToRefs(useProject())
const {
  createMagic,
  fetchNestedPages,
  addNewPage: _addNewPage,
  createImport,
  flattenedNestedPages,
  openPage,
  isFetching,
  openChildPageTabsOfRootPages,
  isEditAllowed,
} = useDocs()

const indicator = h(Loading3QuartersOutlined, {
  style: {
    fontSize: '2.3rem',
    color: '#c9c9c9',
  },
  spin: true,
})

const showPublishModal = ref(false)

const activeTabKey = ref('all')
// const activeTabPagination = ref(1)
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

// const isPagesFetching = ref(false)
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
const isMagicLoading = ref(false)

const importModalOpen = ref(false)
const importFormData = ref({
  title: '',
  content: '',
})
const isImporting = ref(false)
const importType: Ref<'nuxt' | 'md' | 'docusaurus' | 'vitepress' | null> = ref(null)

const openMagicModal = () => {
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
    magicFormData.value.title = ''
    await fetchNestedPages()
    await openChildPageTabsOfRootPages()
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
    await fetchNestedPages()
    await openChildPageTabsOfRootPages()
  } catch (e) {
    console.error(e)
  } finally {
    importModalOpen.value = false
    isImporting.value = false
  }
}

const addNewPage = () => {
  _addNewPage()
}

const closeMagicModal = () => {
  if (isMagicLoading.value) return

  magicModalOpen.value = false
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

// const loadListData = async ($state: any) => {
//   $state.complete()
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
// }

onMounted(() => {
  fetchNestedPages()
})

</script>

<template>
  <a-layout-content>
    <div class="flex flex-col mx-20 mt-10.5 px-6">
      <div class="flex flex-col h-16">
        <div class="flex flex-row justify-between mt-2 items-center">
          <div class="flex flex-row gap-x-6 items-center">
            <div class="flex text-4xl font-semibold">{{ project?.title }}</div>
            <a-dropdown v-if="isEditAllowed" overlay-class-name="nc-docs-menu" trigger="click">
              <div
                class="flex flex-row !bg-gray-50 rounded-md hover:( !bg-gray-200 !bg-opacity-60) cursor-pointer select-none p-1.5 h-8 items-center"
                @click.prevent
              >
                <MdiDotsVertical class="flex" />
              </div>
              <template #overlay>
                <div class="flex flex-col p-1 bg-gray-100 rounded-md w-48 gap-y-0.5">
                  <div
                    class="flex items-center cursor-pointer select-none px-1.5 py-1.5 text-xs gap-x-2.5 hover:bg-gray-200 rounded-md"
                    @click="() => openImportModal()"
                  >
                    <PhDownloadSimpleFill class="h-3.5" />
                    <div class="flex">Import</div>
                  </div>
                </div>
              </template>
            </a-dropdown>
          </div>
          <div v-if="isEditAllowed" class="flex flex-row gap-x-1 h-10 justify-end">
            <a-dropdown trigger="click" placement="bottomLeft">
              <div
                class="my-1 pl-3 pr-1.5 rounded-md border-gray-100 border-1 flex flex-row max-w-28 mr-2 justify-between items-center gap-x-1 hover:cursor-pointer hover:bg-gray-100"
              >
                <div class="flex" :style="{ fontWeight: 600, fontSize: '0.75rem' }">New Page</div>
                <MdiMenuDown />
              </div>
              <template #overlay>
                <div class="flex flex-col bg-gray-100 shadow-gray-300 shadow-sm w-70 p-1 rounded-md gap-y-1">
                  <div
                    class="flex flex-row items-center text-xs gap-x-2 p-1.5 cursor-pointer rounded-md hover:bg-gray-200"
                    @click="() => addNewPage()"
                  >
                    <MiDocumentAdd class="flex" />
                    <div class="flex">New Blank Page</div>
                  </div>
                  <div
                    class="flex flex-row items-start text-xs gap-x-2 p-1.5 cursor-pointer rounded-md hover:bg-gray-200"
                    @click="openMagicModal"
                  >
                    <PhSparkleFill class="flex text-orange-400 mt-0.5" />
                    <div class="flex flex-col">
                      <div class="flex">Create Pages with Prompt</div>
                      <div class="flex text-gray-500" :style="{ fontSize: '0.6rem' }">
                        Let AI create pages based on your keyword.
                      </div>
                    </div>
                  </div>
                  <div class="flex border-t-1 border-gray-200 mx-1"></div>
                  <div
                    class="flex flex-row items-center text-xs gap-x-2 p-1.5 cursor-pointer rounded-md hover:bg-gray-200"
                    @click="() => openImportModal()"
                  >
                    <PhDownloadSimpleFill class="flex" />
                    <div class="flex">Import</div>
                  </div>
                </div>
              </template>
            </a-dropdown>

            <!-- <a-button type="text" class="!px-2 !border-1 !border-gray-100 !rounded-md" @click="() => openMagicModal()">
              <div class="flex flex-row gap-x-1 items-center">
                <div class="flex pl-1">Create Pages with</div>
                <PhSparkleFill class="text-orange-400 h-3.5" />
              </div>
            </a-button> -->
          </div>
        </div>
      </div>
      <div class="flex flex-row w-full mt-8 !overflow-y-hidden docs-book-list-container h-[calc(100vh-12rem)]">
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
            <div v-if="isFetching.nestedPages">
              <div class="flex flex-col mt-64">
                <a-spin size="large" :indicator="indicator" />
              </div>
            </div>
            <div v-else-if="pages.length === 0" class="h-full flex flex-col justify-center -mt-6">
              <div class="flex flex-col gap-y-3 items-center">
                <img src="~/assets/img/add-page.svg" class="flex h-12" />
                <div class="flex text-xl font-semibold">Lets get started!</div>
                <div class="flex text-xs">Create your first Document.</div>
                <div class="flex flex-row items-center gap-x-5 mt-2">
                  <div
                    class="flex flex-row items-center text-xs gap-x-2 border-gray-200 border-1 py-2 px-4 rounded-md font-semibold cursor-pointer hover:bg-gray-50"
                    @click="addNewPage"
                  >
                    <div>Create New Page</div>
                    <MdiPlus class="h-3.5 font-semibold" />
                  </div>
                  <div
                    class="flex flex-row items-center text-xs gap-x-2 border-gray-200 border-1 py-2 px-4 rounded-md font-semibold cursor-pointer hover:bg-gray-50"
                    @click="openImportModal"
                  >
                    <div>Import Pages</div>
                    <PhDownloadSimpleFill class="h-3.5 font-semibold" />
                  </div>
                  <div
                    class="flex flex-row items-center text-xs gap-x-2 border-gray-200 border-1 py-2 px-4 rounded-md font-semibold cursor-pointer hover:bg-gray-50"
                    @click="openMagicModal"
                  >
                    <div>Create Pages using AI</div>
                    <PhSparkleFill class="flex text-orange-400 h-3.5" />
                  </div>
                </div>
              </div>
            </div>
            <div v-else :key="activeTabKey" class="h-full overflow-y-auto docs-book-infinite-list">
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
<!--    <DocsBookPublishModal :model-value="showPublishModal" @update:model-value="showPublishModal = $event" />-->
    <a-modal
      :visible="magicModalOpen"
      :closable="false"
      ok-text="Submit"
      class="docs-magic-modal"
      :ok-button-props="{ hidden: true } as any"
      :cancel-button-props="{ hidden: true } as any"
      :footer="null"
      :centered="true"
    >
      <div class="flex flex-col px-2.5">
        <div class="flex flex-row items-center justify-between mx-1.5 border-b-1 border-gray-100 pb-2 pt-0.5">
          <div class="flex flex-row ml-1 font-semibold items-center">
            <div class="flex">Create pages with prompt</div>
            <PhSparkleFill :class="{ 'nc-animation-pulse': isMagicLoading }" class="flex ml-2 -mt-0.5 text-orange-400" />
          </div>
          <div
            class="flex hover:bg-gray-50 p-1 rounded-md cursor-pointer"
            :class="{ 'text-gray-400 bg-gray-50 cursor-not-allowed hover:bg-gray-50': isMagicLoading }"
            @click="closeMagicModal"
          >
            <MdiClose class="my-auto h-3.5" />
          </div>
        </div>

        <div class="flex flex-col mx-2 mt-3">
          <a-input v-model:value="magicFormData.title" class="!rounded-md !bg-gray-50" placeholder="Enter prompt" />
        </div>

        <div class="flex flex-row justify-end mr-2 mt-3.5 mb-2">
          <a-button
            :loading="isMagicLoading"
            :disabled="magicFormData.title?.length === 0"
            type="primary"
            class="!rounded-md"
            @click="onMagic"
            >Generate Pages</a-button
          >
        </div>
      </div>
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
.version-publish-status-tootltip {
  .ant-tooltip-inner {
    @apply !rounded-md !border-1 !border-gray-200;
  }
}
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
    background: #f6f6f600;
  }

  /* Handle on hover */
  &::-webkit-scrollbar-thumb:hover {
    background: #f6f6f600;
  }
}
.docs-book-infinite-list:hover {
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

.docs-magic-modal {
  .ant-modal-content {
    @apply !rounded-md;
  }
  .ant-modal-body {
    @apply !py-2.5 !px-0;
  }
  .ant-btn-loading-icon {
    @apply !pb-1;
  }
  .ant-btn {
    @apply !flex !flex-row !items-center;
  }
}
</style>
