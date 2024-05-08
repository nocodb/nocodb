<script setup lang="ts">
const { isUIAllowed } = useRoles()
</script>

<template>
  <div class="h-full overflow-y-auto scrollbar-thin-dull pt-2">
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
  </div>
</template>
