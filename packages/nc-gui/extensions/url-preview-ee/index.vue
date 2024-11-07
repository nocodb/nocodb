<script setup lang="ts">
import { YoutubeVue3 } from 'youtube-vue3'

const { eventBus } = useExtensionHelperOrThrow()

const previewType = ref<'youtube' | 'unsupported'>()
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

eventBus.on((event, payload) => {
  if (event === SmartsheetStoreEvents.CELL_SELECTED) {
    const selectedValue = payload.val
    // We only modify state when something is selected. We don't update on un-selections.
    if (payload.rowId !== null) { // null rowId indicated "un-selection".
      if (isValidURL(selectedValue)) {
        if (matchYT(selectedValue)) {
          const videoId = matchYT(selectedValue)
          previewType.value = 'youtube'
          previewParams.value = { videoId }
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
      <div class="w-full text-center" v-else-if="previewType === 'unsupported'">
        <img src="./assets/alert.svg" class="w-8 mx-auto mb-2" />
        <div class="mb-2 font-bold">URL not supported</div>
        <div>We currently do not support this link.</div>
      </div>
    </div>
  </ExtensionsExtensionWrapper>
</template>
