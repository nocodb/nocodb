<script setup lang="ts">
const props = defineProps<{
  title: string
  description: string
  image: string
}>()
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <img :src="props.image" :alt="title" class="h-50 w-full aspect-video rounded-lg" />
    </div>
    <div class="text-nc-content-gray text-bodyLgBold">Sales Pipeline</div>
    <div class="text-nc-content-gray-subtle2 text-bodyDefaultSm line-clamp-2">
      Track, manage, and optimize your sales process with this Sales Pipeline template, designed to help you close deals faster.
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
