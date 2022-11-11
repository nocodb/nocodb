<template>
  <template v-if="$route.params.nestedPage === 'list'">
    <LazyAccountUserList />
  </template>
  <template v-else-if="$route.params.nestedPage === 'settings'">
    <LazyAccountSignupSettings />
  </template>
  <template v-else-if="$route.params.nestedPage === 'password-reset'">
    <LazyAccountResetPassword />
  </template>
</template>
