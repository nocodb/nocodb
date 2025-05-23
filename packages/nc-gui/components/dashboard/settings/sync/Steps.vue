<script lang="ts" setup>
defineProps<{
  current: number
}>()

const { syncConfigForm } = useSyncStoreOrThrow()
</script>

<template>
  <a-steps class="pointer-events-none" :current="current" size="small">
    <a-step title="Sync Category" />
    <a-step title="Sync Settings" />
    <a-step title="Sources" />
    <a-step v-if="syncConfigForm.sync_category === 'custom'" title="Destination Schema" />
    <a-step title="Review" />
  </a-steps>
</template>
