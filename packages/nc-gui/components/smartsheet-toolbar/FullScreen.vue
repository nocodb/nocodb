<template>
  <a-tooltip placement="bottom">
<!--    todo: i18n -->
    <template #title> {{ isFullScreen ? 'Exit fullscreen' : 'Fullscreen' }}</template>
    <div
      v-e="['c:toolbar:fullscreen']"
      class="nc-fullscreen-btn cursor-pointer flex align-center"
    >
      <MdiFullscreenExit v-if="isFullScreen" @click="isFullScreen = false" />
      <MdiFullscreen v-else @click="isFullScreen = true" />
    </div>
  </a-tooltip>
</template>

<script setup lang="ts">

// provide the sidebar injection state
import { useSidebar } from '~/composables'

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

<style scoped>

</style>
