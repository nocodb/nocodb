<script setup lang="ts">
const { value } = defineProps<{ value?: any }>()
</script>

<template>
  <span>
    {{ value }}
  </span>
</template>
