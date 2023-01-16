<script setup lang="ts">
import { isDrawerOrModalExist, isMac, useNuxtApp } from '#imports'
const showUserModal = ref(false)

const { $e } = useNuxtApp()

useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
  if (e.altKey && !e.shiftKey && !cmdOrCtrl) {
    switch (e.keyCode) {
      case 73: {
        // ALT + I
        if (!isDrawerOrModalExist()) {
          $e('c:shortcut', { key: 'ALT + I' })
          showUserModal.value = true
        }
        break
      }
    }
  }
})
</script>

<template>
  <div
    class="my-auto h-8 flex flex-row items-center gap-x-1.5 bg-gray-100 py-1 px-2.5 rounded-md border-gray-200 border-1 mr-2 cursor-pointer hover:bg-gray-200"
    @click="showUserModal = true"
  >
    <MaterialSymbolsSendOutlineRounded />
    <div class="flex">Share</div>
  </div>

  <LazyDlgShareAndCollaborate v-model:model-value="showUserModal" />
</template>
