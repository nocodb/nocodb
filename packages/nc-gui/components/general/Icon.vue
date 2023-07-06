<script lang="ts" setup>
import { iconMap } from '#imports'

const props = defineProps<{
  icon: keyof typeof iconMap
}>()
</script>

<template>
  <component :is="iconMap[props.icon]" />
</template>
