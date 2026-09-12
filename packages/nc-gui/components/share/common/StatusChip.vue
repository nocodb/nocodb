<script lang="ts" setup>
interface Props {
  label: string
}

defineProps<Props>()
</script>

<template>
  <span
    class="nc-share-status-chip inline-flex items-center gap-1.5 text-nc-content-gray-subtle text-bodySm select-none"
    role="status"
  >
    <span class="nc-share-status-dot flex-none w-1.5 h-1.5 rounded-full bg-nc-fill-success" aria-hidden="true" />
    {{ label }}
  </span>
</template>
