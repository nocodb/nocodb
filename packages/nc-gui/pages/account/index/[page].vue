<script setup lang="ts">
const { appInfo } = useGlobal()
</script>

<template>
  <div>
    <AccountToken v-if="$route.params.page === 'tokens'" />
    <div v-else-if="$route.params.page === 'audit'" class="h-[calc(100vh_-_4rem)] w-full px-6">
      <WorkspaceAuditLogs />
    </div>
    <AccountProfile v-else-if="$route.params.page === 'profile'" />
    <AccountAppStore v-else-if="$route.params.page === 'apps' && !appInfo.isCloud" />
    <AccountIntegration v-else-if="$route.params.page === 'integration' && !appInfo.isCloud" />
    <span v-else></span>
  </div>
</template>
