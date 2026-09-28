<script setup lang="ts">
import type { VaultType } from 'nocodb-sdk'

// CE stub — see the EE overlay.
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
