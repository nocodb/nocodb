<script setup lang="ts">
interface Props {
  srcs: string[]
  alt?: string
  mimeType?: string
  objectFit?: string
}

const props = defineProps<Props>()

const index = ref(0)

const onError = () => index.value++
</script>

<template>
  <video controls>
    <source :src="props.srcs[index]" :type="props.mimeType" />
    Your browser does not support the video tag.
  </video>
</template>

<style scoped lang="scss"></style>
