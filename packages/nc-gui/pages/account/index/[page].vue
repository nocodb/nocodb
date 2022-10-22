<script>
export default {
  name: 'Index',
}
</script>

<template>
  <AccountUserManagement v-if="$route.params.page === 'users'" />
  <AccountToken v-else-if="$route.params.page === 'tokens'" />
  <AccountLicense v-else-if="$route.params.page === 'license'" />
  <span v-else></span>
</template>

<style scoped></style>
