<script setup lang="ts">
const props = defineProps<{
  baseId: string
}>()
</script>

<template>
  <div class="w-full h-full !p-0">
    <ErdView :base-id="props.baseId" />
  </div>
</template>
