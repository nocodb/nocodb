<script setup lang="ts">
import { YoutubeVue3 } from 'youtube-vue3'

const { eventBus } = useExtensionHelperOrThrow()

const previewType = ref<'youtube' | 'figma' | 'unsupported'>()
const previewParams = ref<any>({})
const showEmptyState = computed(() => !previewType.value)

const YOUTUBE_RE = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
const matchYT = (url: string) => {
  try {
    // Extract the ID using regex
    const match = url.match(YOUTUBE_RE)
    return match ? match[1] : null
  } catch (error) {
    return null
  }
}

const FIGMA_RE =
  /^https?:\/\/(www\.|)figma\.com\/(file|proto|design)\/([0-9a-zA-Z]{22,})(?:\/.*)?(?:\?node-id=([0-9%:A-Za-z-]+))?/

const matchFigma = (url: string) => {
  try {
    const match = url.match(FIGMA_RE)
    if (!match) {
      return null
    }

    const [, , type, fileId, nodeId] = match
    let embedUrl = null
    switch (type) {
      case 'file':
        embedUrl = `https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/file/${fileId}`
        if (nodeId) {
          embedUrl += `/?node-id=${nodeId}`
        }
        break
      case 'proto':
        embedUrl = `https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/proto/${fileId}`
        break
      case 'design':
        embedUrl = `https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/design/${fileId}`
        if (nodeId) {
          embedUrl += `/?node-id=${nodeId}`
        }
        break
    }
    return embedUrl
  } catch (error) {
    return null
  }
}

eventBus.on((event, payload) => {
  if (event === SmartsheetStoreEvents.CELL_SELECTED) {
    const selectedValue = payload.val
    // We only modify state when something is selected. We don't update on un-selections.
    // null rowId indicates "un-selection".
    if (payload.rowId !== null) {
      if (isValidURL(selectedValue)) {
        if (matchYT(selectedValue)) {
          const videoId = matchYT(selectedValue)
          previewType.value = 'youtube'
          previewParams.value = { videoId }
        } else if (matchFigma(selectedValue)) {
          const embedURL = matchFigma(selectedValue)
          previewType.value = 'figma'
          previewParams.value = { embedURL }
        } else {
          previewType.value = 'unsupported'
          previewParams.value = {}
        }
      } else {
        previewType.value = undefined
        previewParams.value = {}
      }
    }
  }
})
</script>

<template>
  <ExtensionsExtensionWrapper>
    <div class="h-full flex h-full justify-center items-center">
      <div class="w-full text-center" v-if="showEmptyState">
        <div class="mb-2">To view a preview, select a cell in the URL field.</div>
        <img src="./assets/empty-state-banner.svg" class="w-80 mx-auto" />
      </div>
      <!-- @vue-expect-error -->
      <YoutubeVue3 class="w-full h-full" :videoid="previewParams.videoId" :autoplay="0" v-else-if="previewType === 'youtube'" />
      <iframe class="w-full h-full" :src="previewParams.embedURL" v-else-if="previewType === 'figma'"></iframe>
      <div class="w-full text-center" v-else-if="previewType === 'unsupported'">
        <GeneralIcon icon="alertTriangleSolid" class="!text-red-700 w-8 h-8 flex-none" />
        <div class="mb-2 font-bold">URL not supported</div>
        <div>We currently do not support this link.</div>
      </div>
    </div>
  </ExtensionsExtensionWrapper>
</template>
