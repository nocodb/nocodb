<script lang="ts" setup>
interface Emits {
  (event: 'close'): void
}

const emits = defineEmits<Emits>()

const { openedPage, updatePage, nestedUrl } = useDocs()

const isPagePublishing = ref(false)

const isCopied = ref({
  link: false,
  embed: false,
})

const copyPageUrl = async () => {
  isCopied.value.link = false

  await navigator.clipboard.writeText(nestedUrl(openedPage.value!.id!, { completeUrl: true, publicUrl: true }))

  setTimeout(() => {
    isCopied.value.link = true
  }, 100)
}

const openPageUrl = async () => {
  window.open(nestedUrl(openedPage.value!.id!, { completeUrl: true, publicUrl: true }), '_blank')
}

const embedPageHtml = async () => {
  await navigator.clipboard.writeText(
    `<iframe src="${nestedUrl(openedPage.value!.id!, {
      completeUrl: true,
      publicUrl: true,
    })}" width="100%" height="100%" style="border: none;"></iframe>`,
  )
  isCopied.value.embed = true
}

const togglePagePublishedState = async () => {
  isPagePublishing.value = true

  let pageUpdates
  if (openedPage.value!.is_published) {
    pageUpdates = {
      is_published: false,
    }
  } else {
    pageUpdates = {
      is_published: true,
    }
  }

  try {
    await updatePage({
      pageId: openedPage.value!.id!,
      page: pageUpdates,
    })
  } finally {
    isPagePublishing.value = false
  }
}

watch(
  isPagePublishing,
  () => {
    isCopied.value.link = false
    isCopied.value.embed = false
  },
  {
    deep: true,
  },
)
</script>

<template>
  <div class="flex flex-col">
    <div v-if="openedPage" class="flex flex-col w-full px-3.5 py-3.5 border-gray-200 border-1 rounded-md gap-y-2">
      <div class="flex flex-row w-full justify-between">
        <div class="flex" :style="{ fontWeight: 500 }">Share current page</div>
        <a-switch
          :checked="!!openedPage?.is_published"
          :loading="isPagePublishing"
          class="docs-share-public-toggle"
          @click="togglePagePublishedState"
        />
      </div>
      <div class="flex text-xs">Share only the current selected page</div>
      <div v-if="openedPage?.is_published" class="flex flex-row justify-end text-gray-600 gap-x-1.5">
        <div class="flex py-1.5 px-1.5 hover:bg-gray-100 cursor-pointer rounded-md border-1 border-gray-300" @click="openPageUrl">
          <RiExternalLinkLine class="h-3.75" />
        </div>
        <div
          class="flex py-1.5 px-1.5 hover:bg-gray-100 cursor-pointer rounded-md border-1 border-gray-300"
          :class="{
            '!text-gray-300 !border-gray-200 !cursor-not-allowed': isCopied.embed,
          }"
          @click="embedPageHtml"
        >
          <MdiCodeTags class="h-4" />
        </div>
        <div
          class="flex flex-row py-1 px-1.5 hover:bg-gray-100 cursor-pointer rounded-md border-1 border-gray-300 gap-x-1 items-center"
          @click="copyPageUrl"
        >
          <MdiCheck v-if="isCopied.link" class="h-3.5" />
          <MdiContentCopy v-else class="h-3.5" />
          <div class="flex text-xs" :style="{ fontWeight: 500 }">
            <template v-if="isCopied.link"> Link Copied </template>
            <template v-else> Copy link </template>
          </div>
        </div>
      </div>
    </div>
    <div class="flex flex-row mt-6 mb-1 pt-3 border-t-1 border-gray-200 justify-end">
      <div class="flex !rounded-md border-1 border-gray-200 px-2.5 py-1 hover:bg-gray-50 cursor-pointer" @click="emits('close')">
        Cancel
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.docs-share-public-toggle {
  height: 1.25rem !important;
  min-width: 2.4rem !important;
  width: 2.4rem !important;
  line-height: 1rem;

  .ant-switch-handle {
    height: 1rem !important;
    min-width: 1rem !important;
    line-height: 0.8rem !important;
  }
  .ant-switch-inner {
    height: 1rem !important;
    min-width: 1rem !important;
    line-height: 1rem !important;
  }
}
</style>
