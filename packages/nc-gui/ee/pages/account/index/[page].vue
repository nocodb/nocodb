<script lang="ts" setup>
const { appInfo } = useGlobal()
</script>

<template>
  <div>
    <AccountProfile v-if="$route.params.page === 'profile'" />
    <AccountToken v-else-if="$route.params.page === 'tokens'" />
    <AccountMcp v-else-if="$route.params.page === 'mcp'" />
    <AccountExternalIntegrations v-else-if="$route.params.page === 'external-integrations'" />
    <AccountAppStore v-else-if="$route.params.page === 'apps' && !appInfo.isCloud" />
    <AccountTeams v-else-if="$route.params.page === 'teams'" />
    <AccountLicense v-else-if="$route.params.page === 'license'" />
    <AccountAuthentication v-else-if="$route.params.page === 'authentication'" />
    <AccountOAuthClients v-else-if="$route.params.page === 'oauth-clients'" />
    <AccountSelfHosted v-else-if="$route.params.page === 'self-hosted'" />
    <span v-else></span>
  </div>
</template>
