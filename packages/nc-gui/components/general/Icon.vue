<script lang="ts" setup>
const props = defineProps<{
  icon: keyof typeof iconMap
}>()
</script>

<template>
  <component :is="iconMap[props.icon]" />
</template>
