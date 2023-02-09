<script setup lang="ts">
interface Props {
  src: string[]
  alt?: string
}

const props = defineProps<Props>()

const index = ref(0)

const onError = () => index.value++
</script>

<template>
  <LazyNuxtImg
    v-if="index < props.src.length"
    :src="props.src[index]"
    :onerror="onError"
    :alt="props?.alt || ''"
    placeholder
    quality="75"
  />
  <img v-else src="~/assets/img/file-not-found.png" />
</template>
