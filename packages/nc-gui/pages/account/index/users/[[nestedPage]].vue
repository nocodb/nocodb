<template>
  <template v-if="$route.params.nestedPage === 'password-reset'">
    <LazyAccountResetPassword />
  </template>
  <template v-else-if="$route.params.nestedPage === 'settings' || !isUIAllowed('superAdminUserManagement')">
    <LazyAccountSignupSettings />
  </template>
  <template v-else-if="isUIAllowed('superAdminUserManagement')">
    <LazyAccountUserList />
  </template>
</template>

<script setup lang="ts">

import { useUIPermission } from '#imports'

const { isUIAllowed } = useUIPermission()

</script>
