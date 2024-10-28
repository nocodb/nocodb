<script setup lang="ts">
interface Props {
  src: string[]
  class?: string
}

const props = defineProps<Props>()

const currentIndex = ref(0)

const handleError = () => {
  if (currentIndex.value < props.src.length - 1) {
    currentIndex.value = currentIndex.value + 1
  } else {
    currentIndex.value = -1
  }
}
</script>

<template>
  <pdf-object :class="props.class" :url="src[currentIndex]" class="w-full h-full" @error="handleError" />
</template>

<style scoped lang="scss"></style>
