<template>
  <AdminUserManagement v-if="$route.params.page === 'members'" />
  <AdminSettings v-else-if="$route.params.page === 'settings'" />
  <AdminWorkspaces v-else-if="$route.params.page === 'workspaces'" />
  <AdminBases v-else-if="$route.params.page === 'bases'" />
  <AdminTeams v-else-if="$route.params.page === 'teams'" />
  <AdminScim v-else-if="$route.params.page === 'scim'" />
  <AdminAudit v-else-if="$route.params.page === 'audit'" />
  <AdminSso v-else-if="$route.params.page === 'sso'" />
  <AdminBilling v-else-if="$route.params.page === 'billing'" />
</template>
