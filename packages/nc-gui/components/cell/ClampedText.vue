<script setup lang="ts">
const props = defineProps<{
  value?: string | number | null
  lines?: number
}>()

const wrapper = ref()

const rkey = ref(0)

onMounted(() => {
  const observer = new ResizeObserver(() => {
    rkey.value++
  })

  observer.observe(wrapper.value)
})
</script>

<template>
  <div ref="wrapper">
    <text-clamp :key="rkey" class="w-full h-full break-all" :text="props.value || ''" :max-lines="props.lines" />
  </div>
</template>
