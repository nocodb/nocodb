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
  >
    <div v-if="!isLoaded" class="flex items-center justify-center h-full w-full">
      <GeneralLoader size="xlarge" />
    </div>
    <iframe
      ref="iFrame"
      src="https://w21dqb1x.nocodb.com/#/nc/kanban/d719962a-1666-464f-8789-054a13a747f7?disableTopbar=true&disableToolbar=true"
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
