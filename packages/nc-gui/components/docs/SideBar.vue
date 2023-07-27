<script lang="ts" setup>
import { ref } from 'vue'
import type { TreeProps } from 'ant-design-vue'
import type { AntTreeNodeDropEvent } from 'ant-design-vue/lib/tree'
import type { ProjectType } from 'nocodb-sdk'
import { toRef } from '@vue/runtime-core'
import type { PageSidebarNode } from '~~/lib'

const props = defineProps<{
  project: ProjectType
}>()

const project = toRef(props, 'project')

const { openedPageInSidebar, nestedPagesOfProjects, isEditAllowed, openedPage } = storeToRefs(useDocStore())

const {
  deletePage,
  reorderPages,
  updatePage,
  addNewPage,
  getPageWithParents,
  getChildrenOfPage,
  openPage,
  getAllChildrenOfPage,
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

  onExpandClick(page.id!, true)
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
  (newPage, prevPage) => {
    if (!openedPageInSidebar.value) return

    if (newPage?.id === prevPage?.id) return

    const pageWithParents = getPageWithParents({
      page: openedPageInSidebar.value,
      projectId: project.value.id!,
    }).reverse()

    for (const page of pageWithParents) {
      if (!openedTabs.value.includes(page.id!)) {
        openedTabs.value.push(page.id!)
      }
    }
  },
  {
    immediate: true,
  },
)

onKeyStroke('Enter', () => {
  if (isDeleteModalOpen.value) {
    onDeletePage()
  }
})

function onExpandClick(id: string, expanded: boolean) {
  if (expanded) {
    if (!openedTabs.value.includes(id)) {
      openedTabs.value.push(id)
    }
  } else {
    const children = getAllChildrenOfPage({ pageId: id, projectId: project.value.id! })
    const pageIdWithChildrenId = [id, ...children.map((child) => child.id)]

    setTimeout(() => {
      openedTabs.value = openedTabs.value.filter((tab) => !pageIdWithChildrenId.includes(tab))
    }, 0)
  }
}
</script>

<template>
  <template v-if="nestedPages">
    <div class="nc-docs-sidebar">
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
        <template #switcherIcon="{ expanded, children, key }">
          <div
            class="flex flex-row nc-sidebar-expand h-full items-center justify-end"
            :style="{
              width: children.length > 0 ? `${(children[0].level - 1) * 2.5 + 3.5}rem` : undefined,
              marginLeft: children.length > 0 ? '-1.25rem' : undefined,
            }"
            @click="() => onExpandClick(key, !expanded)"
          >
            <PhTriangleFill
              class="cursor-pointer transform transition-transform duration-500 h-1.25 text-gray-500"
              :class="{ 'rotate-180': expanded, 'rotate-90': !expanded }"
            />
          </div>
        </template>
        <template #title="page">
          <div
            class="flex flex-row items-center justify-between group"
            :data-testid="`docs-sidebar-page-${project.title}-${page.title}`"
            :data-level="page.level"
          >
            <div
              class="flex h-6"
              :style="{
                width: !page.children || page.children.length === 0 ? `${page.level * 2.5 + 2.25}rem` : undefined,
              }"
              @click="onTabSelect(page)"
            ></div>
            <div
              class="flex flex-row gap-x-1 text-ellipsis overflow-clip min-w-0 transition-all duration-200 ease-in-out"
              :class="{}"
            >
              <div class="nc-docs-sidebar-spacer"></div>
              <div class="flex flex-shrink-0">
                <a-popover
                  :visible="isEditAllowed ? undefined : false"
                  placement="bottom"
                  overlay-class-name="docs-page-icon-change-popover"
                  color="#000000"
                >
                  <template #content> Change Icon </template>
                  <LazyGeneralEmojiPicker
                    :key="page.icon"
                    :emoji="page.icon"
                    size="small"
                    clearable
                    :readonly="!isEditAllowed"
                    @emoji-selected="setIcon(page.id, $event)"
                  >
                    <template #default>
                      <MdiFileDocumentOutline
                        class="text-gray-600 text-sm"
                        :class="{
                          'text-black': openedPage?.id === page.id,
                        }"
                      />
                    </template>
                  </LazyGeneralEmojiPicker>
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
  @apply flex flex-row items-center w-full rounded-md pb-0 h-7.25 hover:bg-hover mb-0.25 !important;
  transition: none !important;
}

.ant-tree-treenode:hover {
  .nc-sidebar-expand {
    @apply !text-gray-500;
  }
}
.ant-tree-treenode:last-child {
  @apply !mb-0;
}
.ant-tree-node-content-wrapper {
  @apply w-full mr-0.5 pl-0.5 bg-inherit transition-none !important;
  transition: none !important;
}

.ant-tree-list {
  .ant-tree-treenode-selected {
    @apply !bg-primary-selected;
    transition: none !important;
  }
  .ant-tree-node-selected {
    transition: none !important;
    @apply !bg-primary-selected !hover:bg-primary-selected font-semibold;
  }
  .ant-tree-indent-unit {
    @apply w-0 !important;
  }
}
.ant-tree-switcher {
  width: fit-content;
}
.nc-docs-menu .ant-dropdown-menu-item {
  @apply p-0 !important;
}
</style>
