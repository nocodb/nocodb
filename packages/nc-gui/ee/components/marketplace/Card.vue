<script setup lang="ts">
const props = defineProps<{
  title: string
  description: string
  image: string
}>()
</script>

<template>
  <div class="flex flex-col gap-2 h-full cursor-pointer">
    <div class="flex items-center gap-2">
      <NuxtImg :src="props.image" :alt="props.title" loading="lazy" class="h-50 w-full aspect-video rounded-lg object-cover" />
    </div>
    <div class="text-nc-content-gray text-bodyLgBold">{{ props.title }}</div>
    <div class="text-nc-content-gray-subtle2 text-bodyDefaultSm line-clamp-2">
      {{ props.description }}
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
