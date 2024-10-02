<script setup lang="ts">
const iFrame = ref<HTMLIFrameElement | null>(null)

const isLoaded = ref(false)

const handleIframeLoad = () => {
  isLoaded.value = true
}
</script>

<template>
  <div
    :style="{
      height: 'calc(100dvh - var(--toolbar-height) + 4rem)',
    }"
    :class="{
      'hidden': !isLoaded,
      'block h-full': isLoaded,
    }"
  >
    <!--
    src="https://w21dqb1x.nocodb.com/#/nc/kanban/d719962a-1666-464f-8789-054a13a747f7"
-->

    <iframe
      ref="iFrame"
      src="http://localhost:3000/#/nc/kanban/dc9d297d-2d89-4a33-9804-87924148913a?disableTopbar=true&disableToolbar=true"
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
