<script lang="ts" setup>
import { ref } from 'vue'
import type { TreeProps } from 'ant-design-vue'

// todo: Move the ant tree data converstion from the composables to here
const { fetchPages, pages, createPage, openedPageId } = useDocs()

const createPageModalOpen = ref(false)
const createPageFormData = ref({
  title: '',
  content: '',
})
const parentPageId = ref()

const expandedKeys = ref<string[]>([])

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
    openedPageId.value = openedKeys[0]
  },
})

const onOk = async () => {
  await createPage({ ...createPageFormData.value, parentPageId: parentPageId.value } as any)
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
    class="relative shadow-md h-full z-1 nc-left-sidebar"
    :trigger="null"
    collapsible
    theme="light"
  >
    <div class="py-2 flex flex-row justify-between items-center px-3">
      <div>Pages</div>
      <div class="hover:(text-primary/100) cursor-pointer select-none" @click="() => openCreatePageModal()">
        <MdiPlus />
      </div>
    </div>
    <a-tree
      v-model:expandedKeys="expandedKeys"
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
      <a-form-item label="Content">
        <a-input v-model:value="createPageFormData.content" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
