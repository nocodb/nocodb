<script setup lang="ts">
import { isDrawerOrModalExist, isMac, useNuxtApp } from '#imports'

const { visibility, showShareModal } = storeToRefs(useShare())

const { $e } = useNuxtApp()

useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
  if (e.altKey && !e.shiftKey && !cmdOrCtrl) {
    switch (e.keyCode) {
      case 73: {
        // ALT + I
        if (!isDrawerOrModalExist()) {
          $e('c:shortcut', { key: 'ALT + I' })
          showShareModal.value = true
        }
        break
      }
    }
  }
})
</script>

<template>
  <div
    v-if="visibility !== 'hidden'"
    class="flex flex-col justify-center h-full mr-1"
    data-testid="share-project-button"
    :data-sharetype="visibility"
  >
    <div
      class="flex flex-row items-center gap-x-1.5 bg-primary text-white hover:bg-opacity-80 py-0.75 px-2 rounded-md cursor-pointer"
      :class="{
        '!pl-3': visibility === 'none',
      }"
      @click="showShareModal = true"
    >
      <MaterialSymbolsPublic v-if="visibility === 'public'" class="h-3.5" />
      <MaterialSymbolsLockOutline v-else-if="visibility === 'private'" class="h-3.5" />
      <div class="flex">Share</div>
    </div>
  </div>

  <LazyDlgShareAndCollaborateView />
</template>

<style lang="scss">
.share-status-tootltip {
  .ant-tooltip-inner {
    @apply !rounded-md !border-1 !border-gray-200;
  }
}
</style>
