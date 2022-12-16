<script lang="ts" setup>
import type { Ref } from 'vue'
import { ref } from 'vue'
import type { TreeProps } from 'ant-design-vue'

// todo: Move the ant tree data converstion from the composables to here
const {
  fetchPages,
  pages,
  createPage,
  createMagic,
  createImport,
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
const importParentPageId = ref()
const loadImport = ref(false)
const importType: Ref<'nuxt' | 'md' | 'docusaurus' | 'vitepress' | null> = ref(null)

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

const onMagic = async () => {
  loadMagic.value = true
  await createMagic(magicFormData.value.title)
  await fetchPages()
  magicModalOpen.value = false
  loadMagic.value = false
}

const onImport = async () => {
  loadImport.value = true
  await createImport(importFormData.value.title, 'nuxt')
  await fetchPages()
  importModalOpen.value = false
  loadImport.value = false
}

const openCreatePageModal = (parentId?: string | undefined) => {
  parentPageId.value = parentId
  createPageModalOpen.value = true
}

const openMagicModal = (parentId?: string | undefined) => {
  magicParentPageId.value = parentId
  magicModalOpen.value = true
}

const openImportModal = (parentId?: string | undefined) => {
  importParentPageId.value = parentId
  importType.value = null
  importModalOpen.value = true
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

.nc-docs-menu .ant-dropdown-menu-item {
  @apply p-0 !important;
}
</style>
