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
    <!--
      using '' for :text in text-clamp would keep the previous cell value after changing a filter
      use ' ' instead of '' to trigger update
    -->
    <text-clamp
      :key="`clamp-${key}-${props.value?.toString().length || 0}`"
      class="w-full h-full break-word"
      :text="`${props.value || ' '}`"
      :max-lines="props.lines || 1"
    />
  </div>
</template>
