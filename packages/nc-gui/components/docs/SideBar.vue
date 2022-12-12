<script lang="ts" setup>
import { ref } from 'vue'
import type { TreeProps } from 'ant-design-vue'

// todo: Move the ant tree data converstion from the composables to here
const { fetchPages, pages, createPage, openedPageId, openedTabs } = useDocs()

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

    fetchPages(treeNode.dataRef?.key as string | undefined).then(() => {
      resolve()
    })
  })
}

onMounted(async () => {
  await fetchPages()
})

const openPageTabKeys = computed({
  get: () => [openedPageId.value],
  set: (openedKeys) => {
    if (openedKeys?.length === 0) return
    openedPageId.value = openedKeys[0]
  },
})

const onOk = async () => {
  await createPage({ ...createPageFormData.value, parent_page_id: parentPageId.value })
  createPageModalOpen.value = false
}

const openCreatePageModal = (parentId?: string | undefined) => {
  parentPageId.value = parentId
  createPageModalOpen.value = true
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
    <div class="py-2 flex flex-row justify-between items-center px-3 border-b-warm-gray-200 border-b-1 mb-4">
      <div>Pages</div>
      <div class="flex hover:(text-primary/100) cursor-pointer select-none" @click="() => openCreatePageModal()">
        <MdiPlus />
      </div>
    </div>
    <a-tree
      v-model:expandedKeys="openedTabs"
      v-model:selectedKeys="openPageTabKeys"
      :load-data="onLoadData"
      :tree-data="pages"
      show-icon
    >
      <template #title="{ title, key }">
        <div class="flex flex-row w-full items-center justify-between">
          <div>
            {{ title }}
          </div>
          <div class="flex hover:(text-primary/100) cursor-pointer select-none" @click="() => openCreatePageModal(key)">
            <MdiPlus />
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
  @apply w-full mr-2 pl-2 !important;
}
</style>
