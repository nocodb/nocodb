<script setup lang="ts">
import type { VaultType } from 'nocodb-sdk'

// CE stub — Enterprise Vaults are an EE feature. The EE overlay
// (ee/components/workspace/integrations/Vault/DisconnectModal.vue) asks for the
// vault name before disconnecting it.
withDefaults(
  defineProps<{
    modelValue: boolean
    vault?: VaultType
    scope?: 'workspace' | 'org'
    orgId?: string
  }>(),
  {
    vault: undefined,
    scope: 'workspace',
    orgId: undefined,
  },
)

defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'deleted', value: string): void
}>()
</script>

<template>
  <NcSpanHidden />
</template>
