<script lang="ts" setup>
const { appInfo } = useGlobal()

const { isUIAllowed } = useRoles()
</script>

<template>
  <div>
    <AccountProfile v-if="$route.params.page === 'profile'" />
    <AccountToken v-else-if="$route.params.page === 'tokens'" />
    <AccountAppStore v-else-if="$route.params.page === 'apps' && !appInfo.isCloud" />
    <AccountLicense v-else-if="$route.params.page === 'license'" />
    <AccountAuthentication v-else-if="$route.params.page === 'authentication'" />
    <AccountAudits v-else-if="isUIAllowed('ssoSettings') && $route.params.page === 'audits'" />
    <span v-else></span>
  </div>
</template>
