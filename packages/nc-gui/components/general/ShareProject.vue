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
  <a-tooltip placement="bottom" color="#F2F4F7" overlay-class-name="share-status-tootltip" :mouse-enter-delay="0.25">
    <template #title>
      <div class="flex flex-col text-black px-1 py-0.5">
        <template v-if="visibility === 'public'">
          <div :style="{ fontSize: '0.8rem' }" style="font-weight: 500">Page Edits</div>
          <div :style="{ fontSize: '0.65rem' }">Page edits will immediately be updated to public link</div>
          <div :style="{ fontSize: '0.8rem' }" class="pt-1" style="font-weight: 500">New Page</div>
          <div :style="{ fontSize: '0.65rem' }">New pages created will be published</div>
        </template>
        <template v-else>
          <div :style="{ fontSize: '0.8rem' }" style="font-weight: 500">Page Edits</div>
          <div :style="{ fontSize: '0.65rem' }">Page edits will be saved to your project</div>
          <div :style="{ fontSize: '0.8rem' }" class="pt-1" style="font-weight: 500">New Page</div>
          <div :style="{ fontSize: '0.65rem' }">New pages created will be saved to your project</div>
        </template>
      </div>
    </template>
    <div
      class="my-auto h-7 flex flex-row items-center gap-x-1.5 bg-primary text-white hover:bg-opacity-80 py-1.5 px-2 rounded-md mr-2 cursor-pointer"
      @click="showModal = true"
    >
      <MaterialSymbolsPublic v-if="visibility === 'public'" class="h-3.5" />
      <MaterialSymbolsLockOutline v-else-if="visibility === 'private'" class="h-3.5" />
      <div class="flex">Share</div>
    </div>
  </a-tooltip>

  <LazyDlgShareAndCollaborate v-model:model-value="showModal" />
</template>

<style lang="scss">
.share-status-tootltip {
  .ant-tooltip-inner {
    @apply !rounded-md !border-1 !border-gray-200;
  }
}
</style>
