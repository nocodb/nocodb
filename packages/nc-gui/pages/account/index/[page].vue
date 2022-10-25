<template>
  <AccountUserManagement v-if="$route.params.page === 'users'" />
  <AccountToken v-else-if="$route.params.page === 'tokens'" />
  <AccountAppStore v-else-if="$route.params.page === 'apps'" />
  <span v-else></span>
</template>
