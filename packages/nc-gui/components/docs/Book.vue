<script lang="ts" setup>
import type { Ref } from 'vue'
import type { PageSidebarNode } from '~/composables/docs/useDocs'

const { project } = useProject()
const {
  openedBook,
  bulkPublish,
  books,
  selectBook,
  drafts,
  fetchDrafts,
  createBook,
  createMagic,
  fetchBooks,
  navigateToLastBook,
  addNewPage,
  createImport,
} = useDocs()

const isDraftsOpen = ref(false)
const draftsFormData = ref<Array<PageSidebarNode & { selected: boolean }>>([])
const isPagePublishing = ref(false)

const showCreateBookModal = ref(false)
const bookFormModelData = ref({
  title: '',
})

const haveDrafts = computed(() => drafts.value.length > 0)

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

const publishDrafts = async () => {
  isPagePublishing.value = true

  try {
    await bulkPublish(draftsFormData.value.filter((draft) => draft.selected))
  } catch (e) {
    console.error(e)
  } finally {
    isPagePublishing.value = false
    isDraftsOpen.value = false
  }
}

const openDrafts = async () => {
  await fetchDrafts()
  draftsFormData.value = drafts.value.map((draft) => ({ ...draft, selected: true }))
  isDraftsOpen.value = true
}

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
</script>

<template>
  <a-layout-content>
    <div class="flex flex-col mx-20 mt-10.5 px-6">
      <div class="flex flex-row justify-between">
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
          <a-button type="primary" :disabled="!haveDrafts" :loading="isPagePublishing" @click="openDrafts">
            Publish v{{ openedBook?.order }}</a-button
          >
        </div>
      </div>
      <div class="flex flex-row justify-between mt-10">
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
    <a-modal
      :visible="isDraftsOpen"
      title="Publish drafts"
      :mask-closable="false"
      ok-text="Publish"
      :cancel-button-props="{ disabled: isPagePublishing }"
      :confirm-loading="isPagePublishing"
      @cancel="isDraftsOpen = false"
      @ok="publishDrafts"
    >
      <li v-for="draft in draftsFormData" :key="draft.id">
        <a-checkbox v-model:checked="draft.selected" :value="draft.id">
          {{ draft.title }}
        </a-checkbox>
      </li>
    </a-modal>
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
        <div class="flex flex-col">
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
