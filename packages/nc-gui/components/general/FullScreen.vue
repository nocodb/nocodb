<script setup lang="ts">
import { useSidebar } from '#imports'

const rightSidebar = useSidebar('nc-right-sidebar')
const leftSidebar = useSidebar('nc-left-sidebar')

const isFullScreen = computed({
  get: () => !(rightSidebar.isOpen.value || leftSidebar.isOpen.value),
  set: (value) => {
    rightSidebar.toggle(!value)
    leftSidebar.toggle(!value)
  },
})
</script>

<template>
  <a-tooltip>
    <!-- todo: i18n -->
    <template #title> {{ isFullScreen ? 'Exit full width' : 'Full width' }}</template>
    <div
      v-e="['c:toolbar:fullscreen']"
      class="nc-fullscreen-btn cursor-pointer flex align-center self-center px-2 py-2 mr-2"
      @click="isFullScreen = !isFullScreen"
    >
      <IcTwotoneWidthNormal v-if="isFullScreen" class="text-gray-300" />
      <IcTwotoneWidthFull v-else class="text-gray-300" />
    </div>
  </a-tooltip>
</template>
