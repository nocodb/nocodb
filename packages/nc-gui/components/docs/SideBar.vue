<script lang="ts" setup>
import { ref } from 'vue'
import type { TreeProps } from 'ant-design-vue'
import type { AntTreeNodeDropEvent } from 'ant-design-vue/lib/tree'
import { Icon as IconifyIcon } from '@iconify/vue'
import type { ProjectType } from 'nocodb-sdk'
import { onMounted, toRef } from '@vue/runtime-core'
import type { PageSidebarNode } from '~~/lib'

const props = defineProps<{
  project: ProjectType
}>()

const project = toRef(props, 'project')

const { isPublic, openedPageInSidebar, nestedPagesOfProjects, isEditAllowed, openedTabsOfProjects, openedPage } = storeToRefs(
  useDocStore(),
)

const {
  fetchNestedPages,
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

const isDeleteModalOpen = ref(false)
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

const onDeletePage = async () => {
  await deletePage({ pageId: selectedPageId.value })

  selectedPageId.value = undefined
  isDeleteModalOpen.value = false
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

const onTabSelect = (page: PageSidebarNode) => {
  if (openedPage.value?.id === page.id) return

  openPage({
    page,
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
  if (isDeleteModalOpen.value) {
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
    <div class="nc-docs-sidebar mb-1">
      <a-tree
        v-model:expanded-keys="openedTabs"
        v-model:selectedKeys="openPageTabKeys"
        :load-data="onLoadData"
        :tree-data="nestedPages"
        :draggable="isEditAllowed"
        :on-drop="onDrop"
        class="!w-full h-full overflow-y-scroll !overflow-x-hidden !bg-inherit"
        @dragenter="onDragEnter"
      >
        <template #title="page">
          <div
            class="flex flex-row items-center justify-between group pt-1"
            :data-testid="`docs-sidebar-page-${project.title}-${page.title}`"
            :data-level="page.level"
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
                        v-if="page.icon"
                        :key="page.icon"
                        :data-testid="`nc-doc-page-icon-${page.icon}`"
                        class="text-lg"
                        :icon="page.icon"
                      ></IconifyIcon>
                      <MdiFileDocumentOutline v-else />
                    </div>
                    <template #overlay>
                      <div class="flex flex-col p-1 bg-gray-50 rounded-md">
                        <GeneralEmojiIcons class="shadow p-2" @select-icon="setIcon(page.id, $event)" />
                      </div>
                    </template>
                  </a-dropdown>
                </a-popover>
              </div>
              <span
                class="text-ellipsis overflow-hidden nc-docs-sidebar-page-title"
                :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
                @click="() => onTabSelect(page)"
              >
                {{ !page.title ? EMPTY_TITLE_PLACEHOLDER_DOCS : page.title }}
              </span>
            </div>
            <!-- Select page when clicked on the empty area in the sidebar node -->
            <div class="flex flex-grow h-6" @click="() => onTabSelect(page)"></div>
            <DocsSidebarPageOption
              :level="page.level"
              @open-delete-modal="isDeleteModalOpen = true"
              @update-selected-page-id="selectedPageId = page.id"
              @add-new-page="() => addNewPage({ parentPageId: page.id, projectId: project.id! })"
            />
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
    </div>

    <a-modal v-model:visible="isDeleteModalOpen" centered :closable="false" :footer="false">
      <div class="flex flex-col ml-2">
        <div class="flex ml-1">Are you sure you want to delete this page?</div>
        <div class="flex flex-row mt-4 space-x-3">
          <a-button type="text" @click="isDeleteModalOpen = false">Cancel</a-button>
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
  @apply w-full rounded-md mt-0.65 pl-6 !important;
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
    @apply hover:bg-hover;
    transition: none !important;
  }
  .ant-tree-treenode-selected {
    @apply !bg-primary-selected;
    transition: none !important;
  }
  .ant-tree-node-selected {
    transition: none !important;
    @apply !bg-primary-selected !hover:bg-primary-selected;
  }
  .ant-tree-indent-unit {
    @apply w-5 !important;
  }
  .ant-tree-switcher.ant-tree-switcher-noop {
    @apply w-6;
  }
}

.nc-docs-menu .ant-dropdown-menu-item {
  @apply p-0 !important;
}
</style>
