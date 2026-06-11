<script setup lang="ts">
interface Props {
  src: string[]
  class?: string
}

const props = defineProps<Props>()

const emits = defineEmits(['error'])

const currentIndex = ref(0)

const handleError = async () => {
  if (currentIndex.value < props.src.length - 1) {
    currentIndex.value = currentIndex.value + 1
  } else {
    const isURLExp = await isURLExpired(props.src[0])
    if (isURLExp.isExpired) {
      emits('error')
    }
    currentIndex.value = 0
  }
}
</script>

<template>
  <pdf-object :class="props.class" :url="src[currentIndex]" class="w-full h-full" @error="handleError" />
</template>
