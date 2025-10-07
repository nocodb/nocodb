<script setup lang="ts">
const { isUIAllowed } = useRoles()
</script>

<template>
  <div class="h-full">
    <template
      v-if="
        $route.params.nestedPage === 'password-reset' ||
        (!isUIAllowed('superAdminUserManagement') && !isUIAllowed('superAdminAppSettings'))
      "
    >
      <AccountResetPassword />
    </template>
    <template v-else-if="$route.params.nestedPage === 'settings'">
      <AccountSignupSettings />
    </template>
    <template v-else-if="isUIAllowed('superAdminUserManagement')">
      <AccountUserList />
    </template>
  </div>
</template>
