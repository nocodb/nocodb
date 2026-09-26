<script setup lang="ts">
// CE stub — Enterprise Vaults are an EE feature. The EE overlay
// (ee/components/admin/Vaults.vue) manages the organization's secrets providers.
withDefaults(
  defineProps<{
    orgId?: string
  }>(),
  {
    orgId: undefined,
  },
)
</script>

<template>
  <NcSpanHidden />
</template>
