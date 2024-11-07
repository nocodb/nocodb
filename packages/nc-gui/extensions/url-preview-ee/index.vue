<script setup lang="ts">
import { getEmbedURL } from './utils'

const { eventBus } = useExtensionHelperOrThrow()

const embedURL = ref<string | null>(null)
const showEmptyState = computed(() => !embedURL.value)

eventBus.on((event, payload) => {
  if (event === SmartsheetStoreEvents.CELL_SELECTED) {
    const selectedValue = payload.val
    // We only modify state when something is selected. We don't update on un-selections.
    // null rowId indicates "un-selection".
    if (payload.rowId !== null) {
      if (isValidURL(selectedValue)) {
        embedURL.value = getEmbedURL(selectedValue)
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
      <div class="w-full text-center" v-else-if="embedURL === 'unsupported'">
        <GeneralIcon icon="alertTriangleSolid" class="!text-red-700 w-8 h-8 flex-none" />
        <div class="mb-2 font-bold">URL not supported</div>
        <div>We currently do not support this link.</div>
      </div>
      <iframe class="w-full h-full" :src="embedURL" v-else-if="embedURL"></iframe>
    </div>
  </ExtensionsExtensionWrapper>
</template>
