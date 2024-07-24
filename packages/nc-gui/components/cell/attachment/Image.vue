<script setup lang="ts">
interface Props {
  srcs: string[]
  alt?: string
  objectFit?: string
}

const props = defineProps<Props>()

const index = ref(0)

const onError = () => index.value++
</script>

<template>
  <LazyNuxtImg
    v-if="index < props.srcs.length"
    :class="{
      '!object-contain': props.objectFit === 'contain',
    }"
    class="m-auto h-full max-h-full w-auto object-cover nc-attachment-image"
    :src="props.srcs[index]"
    :alt="props?.alt || ''"
    placeholder
    quality="75"
    @error="onError"
  />
  <component :is="iconMap.imagePlaceholder" v-else />
</template>
