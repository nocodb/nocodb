<script setup lang="ts">
const props = defineProps<{
  baseId: string
}>()
</script>

<template>
  <div class="w-full h-full !p-0 h-70vh">
    <ErdView :base-id="props.baseId" />
  </div>
</template>
