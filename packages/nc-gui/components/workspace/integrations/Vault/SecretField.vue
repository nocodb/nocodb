<script setup lang="ts">
import type { VaultSecretRef } from 'nocodb-sdk'

// CE stub — Enterprise Vaults are an EE feature. The EE overlay
// (ee/components/workspace/integrations/Vault/SecretField.vue) renders the
// "use a vault" toggle and the vault → secret → property pickers that write a
// `$secretRef` into the form model. In CE the caller keeps its plain input.
defineProps<{
  value?: string | VaultSecretRef | null
  fieldKey: string
  label?: string
}>()

defineEmits<{
  (event: 'update:value', value: string | VaultSecretRef | null): void
}>()
</script>

<template>
  <NcSpanHidden />
</template>
