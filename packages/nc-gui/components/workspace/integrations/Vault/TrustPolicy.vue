<script setup lang="ts">
// CE stub. Real implementation: ee/components/workspace/integrations/Vault/TrustPolicy.vue
import type { VaultProviderType } from 'nocodb-sdk'

defineProps<{
  provider: VaultProviderType | null
  scope?: 'workspace' | 'org'
  orgId?: string
}>()
</script>

<template>
  <NcSpanHidden />
</template>
