<script setup lang="ts">
const iFrame = ref<HTMLIFrameElement | null>(null)

const isLoaded = ref(false)

const handleIframeLoad = () => {
  if (!iFrame.value) {
    return
  }
  const iframeDocument = iFrame.value?.contentDocument || iFrame.value?.contentWindow?.document

  const classList = ['.nc-table-topbar', '.nc-table-toolbar']

  for (const className of classList) {
    nextTick(() => {
      const element = iframeDocument?.querySelector(className)

      if (element) {
        element.remove()
      }
    })
  }
  isLoaded.value = true
}
</script>

<template>
  <div
    :style="{
      height: 'calc(100dvh - var(--toolbar-height))',
    }"
    :class="{
      'hidden': !isLoaded,
      'block h-full': isLoaded,
    }"
  >
    <iframe
      ref="iFrame"
      src="http://localhost:3000/#/nc/kanban/dc9d297d-2d89-4a33-9804-87924148913a"
      width="100%"
      height="100%"
      style="border: none"
      @load="handleIframeLoad"
    ></iframe>
  </div>

  <div v-if="!isLoaded" class="flex items-center justify-center h-full">
    <NcLoader />
  </div>
</template>

<style scoped lang="scss"></style>
