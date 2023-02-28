<script lang="ts" setup>
interface Emits {
  (event: 'close'): void
}

const emits = defineEmits<Emits>()

const { project, updateProject, loadBookProject } = useProject()

const { openedPage, updatePage, nestedUrl } = useDocs()

const isPagePublishing = ref(false)
const isProjectPublishing = ref(false)

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
  await navigator.clipboard.writeText(`${window.location.origin}/#/nc/doc/${project?.value?.id}/public`)
}

const openProjectUrl = async () => {
  window.open(`${window.location.origin}/#/nc/doc/${project?.value?.id}/public`, '_blank')
}

const embedProjectHtml = async () => {
  await navigator.clipboard.writeText(
    `<iframe src="${window.location.origin}/#/nc/doc/${project?.value?.id}/public" width="100%" height="100%" style="border: none;"></iframe>`,
  )
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
}

const togglePagePublishedState = async () => {
  isPagePublishing.value = true
  try {
    await updatePage({
      pageId: openedPage.value!.id!,
      page: {
        is_published: !openedPage.value!.is_published,
      },
    })
  } finally {
    isPagePublishing.value = false
  }
}
</script>

<template>
  <div class="flex flex-col mt-1">
    <div class="flex flex-col w-full px-3.5 py-3.5 border-gray-200 border-1 rounded-md gap-y-2">
      <div class="flex flex-row w-full justify-between">
        <div class="flex" :style="{ fontWeight: 500 }">Share all pages</div>
        <a-switch :checked="projectMeta.isPublic" :loading="isProjectPublishing" @click="toggleProjectPublishedState" />
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
          @click="embedProjectHtml"
        >
          <MdiCodeTags class="h-4" />
        </div>
        <div
          class="flex flex-row py-1 px-1.5 hover:bg-gray-100 cursor-pointer rounded-md border-1 border-gray-300 gap-x-1 items-center"
          @click="copyProjectUrl"
        >
          <MdiContentCopy class="h-3.5" />
          <div class="flex text-xs" :style="{ fontWeight: 500 }">Copy link</div>
        </div>
      </div>
    </div>
    <div
      v-if="openedPage && !projectMeta.isPublic"
      class="flex flex-col w-full px-3.5 py-3.5 border-gray-200 border-1 rounded-md gap-y-2 mt-5"
    >
      <div class="flex flex-row w-full justify-between">
        <div class="flex" :style="{ fontWeight: 500 }">Share current page</div>
        <a-switch :checked="!!openedPage?.is_published" :loading="isPagePublishing" @click="togglePagePublishedState" />
      </div>
      <div class="flex text-xs">Share only the current selected page</div>
      <div v-if="openedPage?.is_published" class="flex flex-row justify-end text-gray-600 gap-x-1.5">
        <div class="flex py-1.5 px-1.5 hover:bg-gray-100 cursor-pointer rounded-md border-1 border-gray-300" @click="openPageUrl">
          <RiExternalLinkLine class="h-3.75" />
        </div>
        <div
          class="flex py-1.5 px-1.5 hover:bg-gray-100 cursor-pointer rounded-md border-1 border-gray-300"
          @click="embedPageHtml"
        >
          <MdiCodeTags class="h-4" />
        </div>
        <div
          class="flex flex-row py-1 px-1.5 hover:bg-gray-100 cursor-pointer rounded-md border-1 border-gray-300 gap-x-1 items-center"
          @click="copyPageUrl"
        >
          <MdiContentCopy class="h-3.5" />
          <div class="flex text-xs" :style="{ fontWeight: 500 }">Copy link</div>
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
