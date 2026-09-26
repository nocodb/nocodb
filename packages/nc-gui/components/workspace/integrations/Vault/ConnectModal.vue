<script setup lang="ts">
import type { VaultType } from 'nocodb-sdk'

// CE stub — Enterprise Vaults are an EE feature. The EE overlay
// (ee/components/workspace/integrations/Vault/ConnectModal.vue) renders the
// 3-step connect wizard.
defineProps<{
  modelValue: boolean
}>()

defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'created', value: VaultType): void
}>()
</script>

<template>
  <NcSpanHidden />
</template>
