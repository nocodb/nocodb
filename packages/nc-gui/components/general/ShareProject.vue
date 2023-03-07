<script setup lang="ts">
import { isDrawerOrModalExist, isMac, useNuxtApp } from '#imports'

const { visibility } = useShare()

const showModal = ref(false)

const { $e } = useNuxtApp()

useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
  if (e.altKey && !e.shiftKey && !cmdOrCtrl) {
    switch (e.keyCode) {
      case 73: {
        // ALT + I
        if (!isDrawerOrModalExist()) {
          $e('c:shortcut', { key: 'ALT + I' })
          showModal.value = true
        }
        break
      }
    }
  }
})
</script>

<template>
  <div
    v-if="visibility !== 'none'"
    class="my-auto h-7.5 flex flex-row items-center gap-x-1.5 bg-primary text-white hover:bg-opacity-80 py-1.5 px-2.5 rounded-md mr-2 cursor-pointer"
    @click="showModal = true"
  >
    <MaterialSymbolsPublic v-if="visibility === 'public'" class="h-3.5" />
    <MaterialSymbolsLockOutline v-else-if="visibility === 'private'" class="h-3.5" />
    <div class="flex">Share</div>
  </div>

  <LazyDlgShareAndCollaborate v-model:model-value="showModal" />
</template>

<style lang="scss">
.share-status-tootltip {
  .ant-tooltip-inner {
    @apply !rounded-md !border-1 !border-gray-200;
  }
}
</style>
