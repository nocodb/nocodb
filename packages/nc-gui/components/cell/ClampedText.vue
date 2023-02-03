<script setup lang="ts">
const props = defineProps<{
  value?: string | number | null
  lines?: number
}>()

const wrapper = ref()

const key = ref(0)

const debouncedRefresh = useDebounceFn(() => {
  key.value++
}, 500)

onMounted(() => {
  const observer = new ResizeObserver(() => {
    debouncedRefresh()
  })

  observer.observe(wrapper.value)
})
</script>

<template>
  <div ref="wrapper">
    <text-clamp
      :key="`clamp-${key}-${props.value?.toString().length || 0}`"
      class="w-full h-full break-all"
      :text="`${props.value || ''}`"
      :max-lines="props.lines"
    />
  </div>
</template>
