<script setup lang="ts">
const props = defineProps<{
  clientName?: string
  redirectUri: string
  verified?: boolean
}>()

const { productName } = useBranding()

const redirectHost = computed(() => {
  try {
    return new URL(props.redirectUri).host
  } catch {
    return props.redirectUri
  }
})
</script>

<template>
  <div class="flex flex-col gap-3 mt-4">
    <div
      class="nc-oauth-redirect-host flex flex-col items-center gap-1 rounded-lg border-1 border-nc-border-gray-medium px-4 py-3 text-center"
    >
      <span class="text-sm text-nc-content-gray-muted">{{ $t('msg.info.oauthRedirectsTo') }}</span>
      <span class="text-lg font-bold text-nc-content-gray-extreme break-all" data-testid="nc-oauth-redirect-host">
        {{ redirectHost }}
      </span>
    </div>

    <NcAlert
      v-if="!verified"
      type="warning"
      class="nc-oauth-unverified"
      :message="$t('msg.warning.oauthClientNotVerifiedTitle', { product: productName })"
      :description="$t('msg.warning.oauthClientNotVerified', { name: clientName, host: redirectHost })"
    />
  </div>
</template>
