<script lang="ts" setup>
const { appInfo } = useGlobal()
</script>

<template>
  <div>
    <AccountProfile v-if="$route.params.page === 'profile'" />
    <AccountToken v-else-if="$route.params.page === 'tokens'" />
    <AccountMCP v-else-if="$route.params.page === 'mcp'" />
    <AccountExternalIntegrations v-else-if="$route.params.page === 'external-integrations'" />
    <AccountAppStore v-else-if="$route.params.page === 'apps' && !appInfo.isCloud" />
    <AccountLicense v-else-if="$route.params.page === 'license'" />
    <AccountAuthentication v-else-if="$route.params.page === 'authentication'" />
    <AccountOAuthClients v-else-if="$route.params.page === 'oauth-clients'" />
    <span v-else></span>
  </div>
</template>
