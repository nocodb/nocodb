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
  <!-- Replacing with Image component as nuxt-image is not triggering @error when the image doesn't load. Will fix later
   TODO: @DarkPhoenix2704 Fix this later
   -->
  <img
    v-if="index < props.srcs?.length"
    :src="props.srcs[index]"
    quality="75"
    :placeholder="props.alt"
    :class="{
      '!object-contain': props.objectFit === 'contain',
    }"
    loading="lazy"
    :alt="props?.alt || ''"
    class="m-auto h-full max-h-full w-auto nc-attachment-image object-cover"
    @error="onError"
  />
  <component :is="iconMap.imagePlaceholder" v-else />
</template>
