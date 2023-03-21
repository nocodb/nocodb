<script lang="ts" setup>
import { storeToRefs } from 'pinia'

const { project } = storeToRefs(useProject())
const { loadProject } = useProject()
const { updateProject } = useProject()
const { projectUrl } = useDocStore()

const projectMeta = computed(() => {
  return typeof project.value.meta === 'string' ? JSON.parse(project.value.meta) : project.value.meta ?? {}
})

const isProjectUpdating = ref(false)

const isCopied = ref({
  link: false,
  embed: false,
})

const copyUrl = async () => {
  isCopied.value.link = false

  await navigator.clipboard.writeText(projectUrl(project.value.id!, { completeUrl: true, publicMode: true }))

  setTimeout(() => {
    isCopied.value.link = true
  }, 100)
}

const openUrl = async () => {
  window.open(projectUrl(project.value.id!, { completeUrl: true, publicMode: true }), '_blank')
}

const embedHtml = async () => {
  await navigator.clipboard.writeText(
    `<iframe src="${projectUrl(project.value.id!, {
      completeUrl: true,
      publicMode: true,
    })}" width="100%" height="100%" style="border: none;"></iframe>`,
  )
  isCopied.value.embed = true
}

const toggleProjectPublicState = async () => {
  isProjectUpdating.value = true

  let updates
  if (projectMeta.value.isPublic) {
    updates = {
      isPublic: false,
    }
  } else {
    updates = {
      isPublic: true,
    }
  }

  try {
    let meta = project.value.meta
    if (typeof meta === 'string') {
      meta = JSON.parse(meta)
    }
    if (!meta) {
      meta = {}
    }

    await updateProject({ meta: { ...(meta as any), ...updates } })

    await loadProject()
  } finally {
    isProjectUpdating.value = false
  }
}

watch(
  isProjectUpdating,
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
  <div class="flex flex-col mb-1">
    <div class="flex flex-col w-full px-3 py-2.5 border-gray-200 border-1 rounded-md gap-y-2">
      <div class="flex flex-row w-full justify-between">
        <div class="flex" :style="{ fontWeight: 500 }">Enable public viewing</div>
        <a-switch
          :checked="projectMeta?.isPublic"
          :loading="isProjectUpdating"
          class="docs-project-share-public-toggle !mt-0.25"
          @click="toggleProjectPublicState"
        />
      </div>
      <div v-if="projectMeta?.isPublic" class="flex flex-row justify-end text-gray-600 gap-x-1.5 my-0.5">
        <div class="flex py-1.5 px-1.5 hover:bg-gray-100 cursor-pointer rounded-md border-1 border-gray-300" @click="openUrl">
          <RiExternalLinkLine class="h-3.75" />
        </div>
        <div
          class="flex py-1.5 px-1.5 hover:bg-gray-100 cursor-pointer rounded-md border-1 border-gray-300"
          :class="{
            '!text-gray-300 !border-gray-200 !cursor-not-allowed': isCopied.embed,
          }"
          @click="embedHtml"
        >
          <MdiCodeTags class="h-4" />
        </div>
        <div
          class="flex flex-row py-1 px-1.5 hover:bg-gray-100 cursor-pointer rounded-md border-1 border-gray-300 gap-x-1 items-center"
          @click="copyUrl"
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
.docs-project-share-public-toggle {
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
