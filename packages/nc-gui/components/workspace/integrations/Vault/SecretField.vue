<script setup lang="ts">
import type { VaultSecretRef } from 'nocodb-sdk'
// CE stub — Enterprise Vaults are an EE feature. The EE overlay
// (ee/components/workspace/integrations/Vault/SecretField.vue) renders the
// "use a vault" toggle and the vault → secret → key pickers that write a
// `{{ secrets.alias.name }}` reference into the form model. In CE the caller
// keeps its plain input.
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
