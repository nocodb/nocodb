<script setup lang="ts">
import type { AuthLastMethod } from '~/composables/useAuthLastMethod'

const props = defineProps<{
  method: AuthLastMethod
}>()

const { lastMethod } = useAuthLastMethod()

// set from the Cognito token and the SSO callback; covers browsers that predate `lastMethod`
const { lastUsedAuthMethod } = useGlobal()

const isLastUsed = computed(() => (lastMethod.value || lastUsedAuthMethod.value) === props.method)
</script>

<template>
  <!-- same look as the last-used provider in AuthSsoProviders -->
  <NcBadge
    v-if="isLastUsed"
    color="brand"
    size="xs"
    :border="false"
    class="flex-none px-2 rounded-[10px] text-[11px] font-semibold"
    data-testid="nc-auth-last-used"
  >
    {{ $t('labels.appTokens.lastUsed') }}
  </NcBadge>
</template>
