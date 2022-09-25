<script setup lang="ts">
interface Props {
  baseId: string
}

const props = defineProps<Props>()
</script>

<template>
  <div class="w-full h-full !p-0 h-70vh">
    <ErdView :base-id="props.baseId" />
  </div>
</template>
