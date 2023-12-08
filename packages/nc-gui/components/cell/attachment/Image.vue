<script setup lang="ts">
import { iconMap } from '#imports'

interface Props {
  srcs: string[]
  alt?: string
}

const props = defineProps<Props>()

const index = ref(0)

const onError = () => index.value++
</script>

<template>
  <LazyNuxtImg
    v-if="index < props.srcs.length"
    class="m-auto object-cover"
    :src="props.srcs[index]"
    :alt="props?.alt || ''"
    placeholder
    quality="75"
    @error="onError"
  />
  <component :is="iconMap.imagePlaceholder" v-else />
</template>
