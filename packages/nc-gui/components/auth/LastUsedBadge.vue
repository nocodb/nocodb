<script setup lang="ts">
import type { AuthLastMethod } from '~/composables/useAuthLastMethod'

const props = defineProps<{
  method: AuthLastMethod
}>()

const { isLastUsed } = useAuthLastMethod()
</script>

<template>
  <!-- same look as the last-used provider in AuthSsoProviders -->
  <NcBadge
    v-if="isLastUsed(props.method)"
    color="brand"
    size="xs"
    :border="false"
    class="flex-none px-2 rounded-[10px] text-[11px] font-semibold"
    data-testid="nc-auth-last-used"
  >
    {{ $t('labels.appTokens.lastUsed') }}
  </NcBadge>
</template>
