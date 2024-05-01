<script lang="ts" setup></script>

<template>
  <AdminUserManagement v-if="$route.params.page === 'members'" />
  <AdminSettings v-else-if="$route.params.page === 'settings'" />
  <AdminWorkspaces v-else-if="$route.params.page === 'workspaces'" />
  <AdminBases v-else-if="$route.params.page === 'bases'" />
  <AdminSso v-else-if="$route.params.page === 'sso'" />
</template>
