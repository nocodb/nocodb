<script lang="ts" setup>
const emit = defineEmits(['mounted'])
const attrs = useAttrs()

onMounted(() => {
  emit('mounted')
})
</script>

<template>
  <slot v-bind="attrs" />
</template>
