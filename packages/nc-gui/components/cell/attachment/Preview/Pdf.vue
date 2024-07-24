<script setup lang="ts">
interface Props {
  src: string
  class?: string
}

const props = defineProps<Props>()

const openMethod = ref<'browser' | 'google' | undefined>()
</script>

<template>
  <div v-if="!openMethod" :class="props.class" class="flex flex-col text-white gap-2 items-center justify-center">
    <GeneralIcon class="w-28 h-28" icon="pdfFile" />

    <div class="flex items-center justify-center gap-2">
      <NcButton type="secondary" @click="openMethod = 'browser'">
        <div class="flex items-center gap-1">
          <GeneralIcon icon="globe" />
          Open in browser
        </div>
      </NcButton>
      <NcButton type="secondary" @click="openMethod = 'google'">
        <div class="flex items-center gap-1">
          <GeneralIcon class="w-4 h-4" icon="googleDocs" />

          Open with Google Docs
        </div>
      </NcButton>
    </div>
  </div>

  <iframe v-if="openMethod === 'browser'" :class="props.class" :src="props.src" width="100%" height="100%"></iframe>
  <iframe
    v-else-if="openMethod === 'google'"
    :class="props.class"
    :src="`https://docs.google.com/viewer?url=${encodeURIComponent(src)}&embedded=true`"
    width="100%"
    height="100%"
    frameborder="0"
  ></iframe>
</template>

<style scoped lang="scss"></style>
