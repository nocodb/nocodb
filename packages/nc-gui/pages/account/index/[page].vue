<script setup lang="ts">
const { appInfo } = useGlobal()
</script>

<template>
  <AccountUserManagement v-if="$route.params.page === 'users'" />
  <AccountToken v-else-if="$route.params.page === 'tokens'" />
  <AccountAppStore v-else-if="$route.params.page === 'apps' && !appInfo.isCloud" />
  <span v-else></span>
</template>
