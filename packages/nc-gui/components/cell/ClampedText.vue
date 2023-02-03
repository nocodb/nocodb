<script setup lang="ts">
const props = defineProps<{
  value?: string | number | null
  lines?: number
}>()

const wrapper = ref()

const key = ref(0)

onMounted(() => {
  const observer = new ResizeObserver(() => {
    key.value++
  })

  observer.observe(wrapper.value)
})
</script>

<template>
  <div ref="wrapper">
    <text-clamp
      :key="key + props.value"
      class="w-full h-full break-all"
      :text="`${props.value || ''}`"
      :max-lines="props.lines"
    />
  </div>
</template>
