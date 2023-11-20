<script setup lang="ts">
const props = defineProps<{
  sourceId: string
  showAllColumns?: boolean
}>()
</script>

<template>
  <div class="w-full h-full !p-0">
    <ErdView :source-id="props.sourceId" :show-all-columns="props.showAllColumns" />
  </div>
</template>
