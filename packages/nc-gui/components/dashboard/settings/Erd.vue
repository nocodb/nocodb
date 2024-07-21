<script setup lang="ts">
const props = defineProps<{
  sourceId: string
  showAllColumns?: boolean
  baseId?: string
}>()
</script>

<template>
  <div class="w-full h-full !p-0">
    <ErdView :base-id="props.baseId" :source-id="props.sourceId" :show-all-columns="props.showAllColumns" />
  </div>
</template>
