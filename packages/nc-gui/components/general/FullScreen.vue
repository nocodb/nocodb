<script setup lang="ts">
import { computed, isDrawerOrModalExist, isMac, useNuxtApp, useSidebar } from '#imports'

const rightSidebar = useSidebar('nc-right-sidebar')

const leftSidebar = useSidebar('nc-left-sidebar')

const { $e } = useNuxtApp()

const isSidebarsOpen = computed({
  get: () => rightSidebar.isOpen.value || leftSidebar.isOpen.value,
  set: (value) => {
    rightSidebar.toggle(value)
    leftSidebar.toggle(value)
  },
})

useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
  if (e.altKey && !e.shiftKey && !cmdOrCtrl) {
    switch (e.keyCode) {
      case 70: {
        // ALT + F
        if (!isDrawerOrModalExist()) {
          $e('c:shortcut', { key: 'ALT + F' })
          isSidebarsOpen.value = !isSidebarsOpen.value
        }
        break
      }
    }
  }
})
</script>

<template>
  <a-tooltip placement="left">
    <template #title>
      <span class="text-xs">{{ isSidebarsOpen ? $t('activity.fullWidth') : $t('activity.exitFullWidth') }}</span>
    </template>
    <div
      v-e="['c:toolbar:fullscreen']"
      class="nc-fullscreen-btn cursor-pointer flex align-center self-center px-2 py-2 mr-2"
      @click="isSidebarsOpen = !isSidebarsOpen"
    >
      <IcTwotoneWidthFull v-if="isSidebarsOpen" class="text-gray-300" />
      <IcTwotoneWidthNormal v-else class="text-gray-300" />
    </div>
  </a-tooltip>
</template>
