<script setup lang="ts">
const { appInfo } = useGlobal()
</script>

<template>
  <AccountUserManagement v-if="$route.params.page === 'users'" />
  <AccountToken v-else-if="$route.params.page === 'tokens'" />
  <AccountProfile v-else-if="$route.params.page === 'profile'" />
  <AccountAppStore v-else-if="$route.params.page === 'apps' && !appInfo.isCloud" />
  <span v-else></span>
</template>
