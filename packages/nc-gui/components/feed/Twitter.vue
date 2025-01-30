<script setup lang="ts">
const scriptTag = ref()

const timelineStatus = reactive({
  isLoaded: false,
  isError: false,
})

const handleIframeLoad = () => {
  setTimeout(() => {
    timelineStatus.isLoaded = true
  }, 2000)
}

const triggerReload = () => {
  timelineStatus.isLoaded = false
  timelineStatus.isError = false
  nextTick(() => {
    scriptTag.value.src = 'https://platform.twitter.com/widgets.js'
  })
}

onMounted(() => {
  scriptTag.value.src = 'https://platform.twitter.com/widgets.js'
})

const handleError = () => {
  timelineStatus.isLoaded = true
  timelineStatus.isError = true
}
</script>

<template>
  <div
    ref="scrollContainer"
    :style="{
      height: 'calc(100dvh - var(--toolbar-height) - 3.25rem)',
    }"
    class="overflow-y-auto nc-scrollbar-md w-full"
  >
    <div v-if="!timelineStatus.isLoaded" class="flex items-center justify-center h-full w-full">
      <GeneralLoader size="xlarge" />
    </div>
    <div v-else-if="timelineStatus.isError" class="h-full flex justify-center items-center">
      <FeedError page="twitter" @reload="triggerReload" />
    </div>

    <div class="mx-auto flex flex-col my-6 items-center">
      <div style="min-width: 650px">
        <a data-chrome="nofooter" class="twitter-timeline" href="https://twitter.com/nocodb?ref_src=twsrc%5Etfw"></a>
        <Script
          v-if="!timelineStatus.isError"
          ref="scriptTag"
          async
          charset="utf-8"
          @load="handleIframeLoad"
          @error="handleError"
        ></Script>
      </div>
    </div>
  </div>
</template>
