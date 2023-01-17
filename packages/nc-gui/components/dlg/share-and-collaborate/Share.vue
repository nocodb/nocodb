<script lang="ts" setup>
interface Emits {
  (event: 'close'): void
}

const emits = defineEmits<Emits>()

const { project } = useProject()

const { openedBook, updateBook, isBookUpdating, bookUrl } = useDocs()

const showPublish = ref(false)

onMounted(() => {
  showPublish.value = false
})

const publishBook = async () => {
  await updateBook(openedBook.value!.id!, { is_published: true })
  showPublish.value = true
}

const copyPublicUrl = async () => {
  await navigator.clipboard.writeText(bookUrl(openedBook.value!.slug!, true))
}

const openPublicUrl = async () => {
  window.open(bookUrl(openedBook.value!.slug!, true), '_blank')
}

const embedHtml = async () => {
  await navigator.clipboard.writeText(
    `<iframe src="${bookUrl(openedBook.value!.slug!, true)}" width="100%" height="100%" style="border: none;"></iframe>`,
  )
}
</script>

<template>
  <div class="flex flex-col h-64">
    <template v-if="openedBook?.is_published">
      <div class="flex flex-col h-64">
        <div class="flex text-xs" :style="{ fontWeight: 500 }">Public share option</div>
        <div v-if="showPublish" class="flex flex-row px-2 py-3 border-green-700 border-1 rounded-md mt-2 bg-green-50">
          <MdiCheck class="my-auto text-green-700" />
          <div class="flex ml-2 text-xs text-green-700">All pages from {{ openedBook?.title }} have been published.</div>
          <div class="flex flex-grow"></div>
        </div>
        <div class="flex flex-row items-center mt-3 w-full border-gray-300 border-1 rounded-md bg-gray-50">
          <div
            class="flex flex-row w-1/3 py-2 px-3.5 justify-center hover:bg-gray-100 cursor-pointer items-center gap-x-3 border-gray-300 border-r-1"
            @click="copyPublicUrl"
          >
            <MdiContentCopy class="!h-3.5" />
            <div>Copy public view link</div>
          </div>
          <div
            class="flex flex-row w-1/3 py-2 px-2 justify-center !hover:bg-gray-100 cursor-pointer items-center gap-x-3 border-gray-300 border-r-1"
            @click="openPublicUrl"
          >
            <MdiOpenInNew class="!h-4" />
            <div>Open public link</div>
          </div>
          <div
            class="flex flex-row w-1/3 py-2 px-3.5 justify-center hover:bg-gray-100 cursor-pointer items-center gap-x-3"
            @click="embedHtml"
          >
            <MdiCodeTags class="!h-4" />
            <div>Embed</div>
          </div>
        </div>
        <div class="flex flex-grow"></div>
        <div class="flex flex-row pt-4 border-t-1 border-gray-200 justify-end">
          <a-button type="primary" class="flex !rounded-md" :style="{ fontWeight: 500 }" @click="emits('close')">Done</a-button>
        </div>
      </div>
    </template>
    <template v-else-if="showPublish && !openedBook?.is_published">
      <div class="flex text-xs" :style="{ fontWeight: 500 }">Public share option</div>
      <div class="flex flex-col bg-gray-100 px-3 mt-2 py-1 border-1 border-gray-200 rounded-md h-60">
        <div class="flex text-base pb-1 border-b-1 border-gray-200 mt-1" :style="{ fontWeight: 500 }">Publish</div>
        <div class="flex flex-row text-xs mt-3">
          <span :style="{ fontWeight: 500 }">All pages in</span>
          <span class="text-gray-500 pl-1">{{ project?.title }}</span>
          <span class="bg-white px-1 border-1 border-gray-200 rounded-md mx-1" :style="{ fontSize: '0.65rem' }">{{
            openedBook?.title
          }}</span>
          <span :style="{ fontWeight: 500 }">will be published.</span>
        </div>
        <div class="flex flex-grow"></div>
        <div class="flex flex-row pt-3 pb-2 border-gray-200 border-t-1 justify-end gap-x-3">
          <a-button
            type="text"
            class="!bg-white !hover:bg-gray-50 !rounded-md !border-gray-200 !border-1"
            @click="showPublish = false"
            >Cancel</a-button
          >
          <a-button type="primary" class="!rounded-md" :loading="isBookUpdating" @click="publishBook">
            Publish {{ openedBook?.title }}
          </a-button>
        </div>
      </div>
    </template>
    <template v-else-if="!showPublish && !openedBook?.is_published">
      <div class="flex text-xs" :style="{ fontWeight: 500 }">Public share option</div>
      <div class="flex flex-row px-2 py-3 border-orange-600 border-1 rounded-md mt-2 bg-orange-50">
        <MdiAlertCircleOutline class="my-auto text-orange-600" />
        <div class="flex ml-2 text-xs text-orange-600">
          This version has not been published. To share public viewing please publish the current selected version.
        </div>
        <div
          class="flex px-3.5 py-0.5 bg-orange-400 text-white rounded-md text-xs items-center cursor-pointer hover:bg-opacity-80"
          :style="{ fontWeight: 500 }"
          @click="showPublish = true"
        >
          Publish
        </div>
      </div>
      <div class="flex flex-grow"></div>
      <div class="flex flex-row pt-4 border-t-1 border-gray-200 justify-end">
        <a-button type="primary" class="flex !rounded-md" :style="{ fontWeight: 500 }" @click="emits('close')">Done</a-button>
      </div>
    </template>
  </div>
</template>
