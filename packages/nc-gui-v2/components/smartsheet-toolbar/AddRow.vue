<script setup lang="ts">
import MdiAddIcon from '~icons/mdi/plus-outline '
const emit = defineEmits(['add-row'])
</script>

<template>
  <MdiAddIcon class="text-grey" @click="emit('add-row')" />
</template>

<style scoped></style>
