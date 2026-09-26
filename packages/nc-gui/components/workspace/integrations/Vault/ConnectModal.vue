<script setup lang="ts">
import type { VaultType } from 'nocodb-sdk'

// CE stub — see the EE overlay.
withDefaults(
  defineProps<{
    modelValue: boolean
    scope?: 'workspace' | 'org'
    orgId?: string
  }>(),
  {
    scope: 'workspace',
    orgId: undefined,
  },
)

defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'created', value: VaultType): void
}>()
</script>

<template>
  <NcSpanHidden />
</template>
