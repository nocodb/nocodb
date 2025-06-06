<script setup lang="ts">
const props = defineProps<{
  title: string
  description: string
  image: string
}>()
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="border-1 border-nc-border-gray-medium px-6 pt-6 rounded-lg"></div>

    <div class="text-nc-content-gray font-bold leading-7">Sales Pipeline</div>
    <div class="text-nc-content-gray-subtle2 leading-4.5 line-clamp-2">
      Track, manage, and optimize your sales process with this Sales Pipeline template, designed to help you close deals faster.
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
