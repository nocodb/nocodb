<script setup lang="ts">
import { useUIPermission } from '#imports'

const { isUIAllowed } = useUIPermission()
</script>

<template>
  <template
    v-if="
      $route.params.nestedPage === 'password-reset' ||
      (!isUIAllowed('superAdminUserManagement') && !isUIAllowed('superAdminAppSettings'))
    "
  >
    <LazyAccountResetPassword />
  </template>
  <template v-else-if="$route.params.nestedPage === 'settings'">
    <LazyAccountSignupSettings />
  </template>
  <template v-else-if="isUIAllowed('superAdminUserManagement')">
    <LazyAccountUserList />
  </template>
</template>
