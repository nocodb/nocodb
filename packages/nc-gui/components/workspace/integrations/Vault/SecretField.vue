<script setup lang="ts">
import type { VaultSecretRef } from 'nocodb-sdk'
// CE stub — see the EE overlay.
defineProps<{
  value?: VaultSecretRef | string | null
  fieldKey: string
  label?: string
}>()

defineEmits<{
  (event: 'update:value', value: VaultSecretRef | string | null): void
  (event: 'update:vaultMode', value: boolean): void
}>()
</script>

<template>
  <NcSpanHidden />
</template>
