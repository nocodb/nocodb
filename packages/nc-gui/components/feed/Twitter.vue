<script setup lang="ts">
const isLoaded = ref(false)

const scriptTag = ref()

const handleIframeLoad = () => {
  setTimeout(() => {
    isLoaded.value = true
  }, 2000)
}

onMounted(() => {
  scriptTag.value.src = 'https://platform.twitter.com/widgets.js'
})
</script>

<template>
  <div
    ref="scrollContainer"
    :style="{
      height: 'calc(100dvh - var(--toolbar-height) - 3.25rem)',
    }"
    class="overflow-y-auto nc-scrollbar-md w-full"
  >
    <div v-if="!isLoaded" class="flex items-center justify-center h-full w-full">
      <GeneralLoader size="xlarge" />
    </div>
    <div class="mx-auto flex flex-col my-6 items-center">
      <div style="min-width: 650px">
        <a class="twitter-timeline" href="https://twitter.com/nocodb?ref_src=twsrc%5Etfw"></a>
        <Script ref="scriptTag" async charset="utf-8" @load="handleIframeLoad"></Script>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
