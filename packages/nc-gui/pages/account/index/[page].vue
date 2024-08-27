<script setup lang="ts">
const { appInfo } = useGlobal()
</script>

<template>
  <div>
    <AccountToken v-if="$route.params.page === 'tokens'" />
    <AccountSetup v-else-if="$route.params.page === 'setup'" />
    <WorkspaceAuditLogs v-else-if="$route.params.page === 'audit'" />
    <AccountProfile v-else-if="$route.params.page === 'profile'" />
    <AccountAppStore v-else-if="$route.params.page === 'apps' && !appInfo.isCloud" />
    <span v-else></span>
  </div>
</template>
