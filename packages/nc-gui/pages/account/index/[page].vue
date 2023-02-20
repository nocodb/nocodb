<template>
  <AccountUserManagement v-if="$route.params.page === 'users'" />
  <AccountToken v-else-if="$route.params.page === 'tokens'" />
  <AccountAppStore v-else-if="$route.params.page === 'apps'" />
  <AccountLicense v-else-if="$route.params.page === 'license'" />
  <span v-else></span>
</template>
