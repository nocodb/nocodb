<script setup lang="ts">
const { appInfo } = useGlobal()
</script>

<template>
  <AccountUserManagement v-if="$route.params.page === 'users'" />
  <AccountProfile v-else-if="$route.params.page === 'profile'" />
  <AccountToken v-else-if="$route.params.page === 'tokens'" />
  <AccountAppStore v-else-if="$route.params.page === 'apps' && !appInfo.isCloud" />
  <AccountLicense v-else-if="$route.params.page === 'license'" />
  <span v-else></span>
</template>
