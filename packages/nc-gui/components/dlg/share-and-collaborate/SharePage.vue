<script lang="ts" setup>
import { storeToRefs } from 'pinia'

interface Emits {
  (event: 'close'): void
}

const emits = defineEmits<Emits>()

const { project } = storeToRefs(useProject())
const { isProjectPublic } = storeToRefs(useShare())
const { openedPage, nestedPublicParentPage, nestedPagesOfProjects } = storeToRefs(useDocStore())
const { updatePage, nestedUrl } = useDocStore()

const isPagePublishing = ref(false)

const isCopied = ref({
  link: false,
  embed: false,
})

const page = computed(() => openedPage.value ?? nestedPagesOfProjects.value[project.value.id!]?.[0])

const copyPageUrl = async () => {
  isCopied.value.link = false

  await navigator.clipboard.writeText(
    nestedUrl({ projectId: project.value.id!, id: page.value!.id!, completeUrl: true, publicUrl: true }),
  )

  setTimeout(() => {
    isCopied.value.link = true
  }, 100)
}

const openPageUrl = async () => {
  window.open(nestedUrl({ projectId: project.value.id!, id: page.value!.id!, completeUrl: true, publicUrl: true }), '_blank')
}

const embedPageHtml = async () => {
  await navigator.clipboard.writeText(
    `<iframe src="${nestedUrl({
      projectId: project.value.id!,
      id: page.value!.id!,
      completeUrl: true,
      publicUrl: true,
    })}" width="100%" height="100%" style="border: none;"></iframe>`,
  )
  isCopied.value.embed = true
}

const isNestedParent = computed(() => nestedPublicParentPage.value?.id === page.value!.id)

const togglePagePublishedState = async () => {
  isPagePublishing.value = true

  let pageUpdates
  if (page.value!.is_published) {
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
      pageId: page.value!.id!,
      page: pageUpdates,
      projectId: project.value.id!,
    })
  } finally {
    isPagePublishing.value = false
  }
}

const openParentPageLink = async () => {
  await navigateTo(
    nestedUrl({
      projectId: project.value.id!,
      id: nestedPublicParentPage.value!.id!,
    }),
  )
  emits('close')
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
  <div class="flex flex-col py-2 px-3 mb-1">
    <div v-if="page" class="flex flex-col w-full mt-2.5 px-3 py-2.5 border-gray-200 border-1 rounded-md gap-y-2">
      <div class="flex flex-row w-full justify-between">
        <div class="flex" :style="{ fontWeight: 500 }">Enable public viewing</div>
        <a-switch
          data-testid="docs-share-page-toggle"
          :checked="isProjectPublic || !!page?.is_published"
          :loading="isPagePublishing"
          class="docs-share-public-toggle !mt-0.25"
          :disabled="isProjectPublic || (page.is_published && !isNestedParent)"
          @click="togglePagePublishedState"
        />
      </div>
      <div v-if="isProjectPublic" class="flex text-xs items-center">
        Shared through project
        <span class="ml-1.5 px-1.5 py-0.5 bg-gray-100 rounded-md capitalize">{{ project.title }}</span>
      </div>
      <div v-else-if="page.is_published && !isNestedParent" class="flex text-xs">
        Shared through page
        <span class="text-blue-600 underline pl-1 cursor-pointer mr-1" @click="openParentPageLink">
          {{ nestedPublicParentPage?.title }}</span
        >
      </div>
      <div v-if="page?.is_published" class="flex flex-row justify-end text-gray-600 gap-x-1.5 my-0.5">
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
          data-testid="docs-share-page-copy-link"
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
