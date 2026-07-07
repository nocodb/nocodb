<script setup lang="ts">
import type { EnvironmentType } from 'nocodb-sdk'

// CE stub — per-user credentials are an EE feature. The EE overlay
// (ee/components/workspace/integrations/forms/EditOrAdd/PerUserSection.vue)
// renders the credential-mode toggle + the caller's "Your connection" card.
defineProps<{
  perUserEnabled: boolean
  activeEnv?: EnvironmentType
  baseId?: string
}>()

defineEmits(['update:perUserEnabled'])
</script>

<template>
  <NcSpanHidden />
</template>
