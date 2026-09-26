<script setup lang="ts">
import type { VaultType } from 'nocodb-sdk'

// CE stub — Enterprise Vaults are an EE feature. The EE overlay
// (ee/components/workspace/integrations/Vault/EditModal.vue) rotates a
// connected vault's auth config.
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
  (event: 'saved', value: VaultType): void
}>()
</script>

<template>
  <NcSpanHidden />
</template>
