<script lang="ts" setup>
import { ref } from 'vue'
import type { TreeProps } from 'ant-design-vue'

// todo: Move the ant tree data converstion from the composables to here
const {
  fetchPages,
  pages,
  createPage,
  openedPageSlug,
  openedTabs,
  fetchNestedChildPagesFromRoute,
  nestedUrl,
  navigateToFirstPage,
} = useDocs()
const route = useRoute()

const createPageModalOpen = ref(false)
const createPageFormData = ref({
  title: '',
  content: '',
})
const parentPageId = ref()

const onLoadData: TreeProps['loadData'] = async (treeNode) => {
  return new Promise((resolve) => {
    if (treeNode.dataRef?.children) {
      resolve()
      return
    }

    fetchPages({ parentPageId: treeNode.dataRef?.id as string | undefined }).then(() => {
      resolve()
    })
  })
}

const openPageTabKeys = computed({
  get: () => [openedPageSlug.value],
  set: () => {},
})

const onOk = async () => {
  await createPage({ ...createPageFormData.value, parent_page_id: parentPageId.value })
  createPageModalOpen.value = false
}

const openCreatePageModal = (parentId?: string | undefined) => {
  parentPageId.value = parentId
  createPageModalOpen.value = true
}

onMounted(async () => {
  await fetchPages()
  if (route.params.slugs?.length === 0) {
    navigateToFirstPage()
  }
  await fetchNestedChildPagesFromRoute()
})

const onTabClick = ({ slug }: { slug: string }) => {
  navigateTo(nestedUrl(slug))
}
</script>

<template>
  <a-layout-sider
    :collapsed="false"
    width="250"
    collapsed-width="50"
    class="relative shadow-md h-full z-1 nc-docs-left-sidebar"
    :trigger="null"
    collapsible
    theme="light"
  >
    <div class="py-2.5 flex flex-row justify-between items-center ml-2 px-2 border-b-warm-gray-100 border-b-1">
      <div class="text-base text-[13px] !font-400">Pages</div>
      <div class="flex flex-row justify-between items-center">
        <div
          class="flex hover:(text-primary/100 !bg-blue-50) cursor-pointer select-none p-1 border-gray-100 border-1 rounded-md mr-1"
          @click="() => openCreatePageModal()"
        >
          <MdiPlus />
        </div>
        <div class="flex hover:(text-primary/100 !bg-blue-50 rounded-md) cursor-pointer select-none p-1">
          <MdiDotsVertical />
        </div>
      </div>
    </div>
    <a-tree
      v-model:expandedKeys="openedTabs"
      v-model:selectedKeys="openPageTabKeys"
      :load-data="onLoadData"
      :tree-data="pages"
      show-icon
    >
      <template #title="{ title, slug, id }">
        <div class="flex flex-row w-full items-center justify-between group pt-1" @click="onTabClick({ slug })">
          <div class="flex">{{ title }}</div>
          <div class="flex flex-row justify-between items-center">
            <div
              class="flex hover:(text-primary/100) cursor-pointer select-none invisible group-hover:visible mr-2"
              @click="() => openCreatePageModal(id)"
            >
              <MdiPlus />
            </div>
            <div
              class="flex hover:(text-primary/100 !bg-blue-50 rounded-md) cursor-pointer select-none invisible group-hover:visible"
            >
              <MdiDotsVertical />
            </div>
          </div>
        </div>
      </template>
    </a-tree>
  </a-layout-sider>
  <a-modal
    :visible="createPageModalOpen"
    title="title"
    :closable="false"
    :mask-closable="false"
    @cancel="createPageModalOpen = false"
    @ok="onOk"
  >
    <a-form :model="createPageFormData">
      <a-form-item label="Title">
        <a-input v-model:value="createPageFormData.title" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style lang="scss">
.nc-docs-left-sidebar .ant-tree-treenode {
  @apply w-full !important;
}
.nc-docs-left-sidebar .ant-tree-node-content-wrapper {
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
</style>
