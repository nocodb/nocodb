<script lang="ts" setup>
interface Emits {
  (event: 'close'): void
}

const emits = defineEmits<Emits>()

const { project, updateProject, loadBookProject } = useProject()

const { openedPage, updatePage, nestedUrl } = useDocs()

const isPagePublishing = ref(false)
const isProjectPublishing = ref(false)
const isNestedPagePublishing = ref(false)
const isCopied = ref({
  link: false,
  embed: false,
})

const projectMeta = computed(() => {
  if (!project.value) {
    throw new Error('Project is not defined')
  }

  if (!project.value.meta) {
    throw new Error('Project meta is not defined')
  }

  if (typeof project.value.meta === 'string') {
    return JSON.parse(project.value.meta)
  } else {
    return project.value.meta
  }
})

const copyProjectUrl = async () => {
  await navigator.clipboard.writeText(`${window.location.origin}/#/nc/doc/${project?.value?.id}/s/`)
  isCopied.value.link = true
}

const openProjectUrl = async () => {
  window.open(`${window.location.origin}/#/nc/doc/${project?.value?.id}/s/`, '_blank')
}

const embedProjectHtml = async () => {
  await navigator.clipboard.writeText(
    `<iframe src="${window.location.origin}/#/nc/doc/${project?.value?.id}/s/" width="100%" height="100%" style="border: none;"></iframe>`,
  )
  isCopied.value.embed = true
}

const toggleProjectPublishedState = async () => {
  isProjectPublishing.value = true
  try {
    await updateProject({
      meta: {
        ...projectMeta.value,
        isPublic: !projectMeta.value.isPublic,
        isCompletelyPublic: !projectMeta.value.isPublic,
      },
    })
    await loadBookProject()
  } finally {
    isProjectPublishing.value = false
  }
}

const copyPageUrl = async () => {
  await navigator.clipboard.writeText(nestedUrl(openedPage.value!.id!, { completeUrl: true, publicUrl: true }))
  isCopied.value.link = true
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
      is_nested_published: false,
    }
  } else {
    pageUpdates = {
      is_published: true,
      is_nested_published: false,
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

const toggleNestedPagePublishedState = async () => {
  isNestedPagePublishing.value = true
  try {
    await updatePage({
      pageId: openedPage.value!.id!,
      page: {
        is_nested_published: !openedPage.value!.is_nested_published,
      },
    })
  } finally {
    isNestedPagePublishing.value = false
  }
}

watch(
  [isNestedPagePublishing, isPagePublishing, isProjectPublishing],
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
  <div class="flex flex-col mt-1">
    <div class="flex flex-col w-full px-3.5 py-3.5 border-gray-200 border-1 rounded-md gap-y-2">
      <div class="flex flex-row w-full justify-between">
        <div class="flex" :style="{ fontWeight: 500 }">Share all pages</div>
        <a-switch
          :checked="projectMeta.isPublic"
          :loading="isProjectPublishing"
          class="docs-share-public-toggle"
          @click="toggleProjectPublishedState"
        />
      </div>
      <div class="flex text-xs">Share all pages in '{{ project?.title }}'</div>
      <div v-if="projectMeta.isPublic" class="flex flex-row justify-end text-gray-600 gap-x-1.5">
        <div
          class="flex py-1.5 px-1.5 hover:bg-gray-100 cursor-pointer rounded-md border-1 border-gray-300"
          @click="openProjectUrl"
        >
          <RiExternalLinkLine class="h-3.75" />
        </div>
        <div
          class="flex py-1.5 px-1.5 hover:bg-gray-100 cursor-pointer rounded-md border-1 border-gray-300"
          :class="{
            '!text-gray-300 !border-gray-200 !cursor-not-allowed': isCopied.embed,
          }"
          @click="embedProjectHtml"
        >
          <MdiCodeTags class="h-4" />
        </div>
        <div
          class="flex flex-row py-1 px-1.5 hover:bg-gray-100 cursor-pointer rounded-md border-1 border-gray-300 gap-x-1 items-center"
          :class="{
            '!text-gray-300 !border-gray-200 !cursor-not-allowed': isCopied.link,
          }"
          @click="copyProjectUrl"
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
    <div
      v-if="openedPage && !projectMeta.isPublic"
      class="flex flex-col w-full px-3.5 py-3.5 border-gray-200 border-1 rounded-md gap-y-2 mt-5"
    >
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
      <div
        v-if="!!openedPage?.is_published"
        class="my-1 flex flex-row w-full justify-between items-center py-2 px-3 bg-gray-100 rounded-md"
      >
        <div class="flex">Share nested pages</div>
        <a-switch
          :checked="!!openedPage?.is_nested_published"
          :loading="isNestedPagePublishing"
          class="docs-share-public-toggle"
          @click="toggleNestedPagePublishedState"
        />
      </div>
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
          :class="{
            '!text-gray-300 !border-gray-200 !cursor-not-allowed': isCopied.link,
          }"
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
    <div class="flex flex-row mt-8 mb-2 pt-4 border-t-1 border-gray-200 justify-end">
      <div
        class="flex !rounded-md border-1 border-gray-200 px-2.5 py-1.5 hover:bg-gray-50 cursor-pointer"
        @click="emits('close')"
      >
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
