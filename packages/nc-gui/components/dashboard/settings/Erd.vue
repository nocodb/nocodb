<script setup lang="ts">
const props = defineProps<{
  sourceId: string
}>()
</script>

<template>
  <div class="w-full h-full !p-0">
    <ErdView :source-id="props.sourceId" />
  </div>
</template>
