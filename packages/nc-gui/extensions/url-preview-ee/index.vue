<script setup lang="ts">
import { getEmbedURL } from './utils'

const { eventBus, fullscreen } = useExtensionHelperOrThrow()

const embedURL = ref<string | null>(null)
const platform = ref<string | null>(null)
const showEmptyState = computed(() => !embedURL.value)
const selectedURL = ref<string | null>(null)

const clearSelection = () => {
  platform.value = null
  embedURL.value = null
  selectedURL.value = null
}

eventBus.on((event, payload) => {
  if (event === SmartsheetStoreEvents.CELL_SELECTED) {
    const selectedValue = payload.val as string
    // We only modify state when something is selected. We don't update on un-selections
    // (except when unsupported url detected).
    // null rowId indicates "un-selection".

    if (payload.rowId !== null) {
      if (selectedValue && isValidURL(selectedValue)) {
        const [platformRaw, embedURLRaw] = getEmbedURL(selectedValue)
        platform.value = platformRaw
        embedURL.value = embedURLRaw
        selectedURL.value = selectedValue
      } else {
        clearSelection()
      }
    } else {
      // Clear on unselection only when invalid url was found. Else, keep as it is.
      if (embedURL.value === 'unsupported') {
        clearSelection()
      }
    }
  }
})

const openSelectedLink = async () => {
  if (selectedURL.value) {
    await navigateTo(selectedURL.value, {
      external: true,
      open: { target: '_blank', windowFeatures: { noopener: true, noreferrer: true } },
    })
  }
}
</script>

<template>
  <ExtensionsExtensionWrapper>
    <template v-if="fullscreen && selectedURL" #headerExtra>
      <NcButton size="small" type="secondary" @click="openSelectedLink">
        <div class="flex gap-1 items-center text-xs">
          <GeneralIcon icon="ncExternalLink" />
          Open in new tab
        </div>
      </NcButton>
    </template>
    <div class="h-full flex justify-center items-center">
      <div v-if="showEmptyState" class="w-full text-center">
        <div class="mb-2">To view a preview, select a cell in the URL field.</div>
        <img src="./assets/empty-state-banner.svg" class="w-80 mx-auto" />
      </div>
      <div v-else-if="embedURL === 'unsupported'" class="w-full text-center">
        <GeneralIcon icon="alertTriangleSolid" class="!text-red-700 w-8 h-8 flex-none" />
        <div class="my-2 font-bold">URL not supported</div>
        <div>
          <a target="_blank" rel="noopener" class="!no-underline"> View supported URLs </a>
        </div>
      </div>
      <iframe v-else-if="embedURL" class="w-full h-full" :class="platform === 'Spotify' ? 'p-2' : ''" :src="embedURL"></iframe>
    </div>
  </ExtensionsExtensionWrapper>
</template>
