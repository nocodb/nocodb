<script>
export default {
  name: 'Index',
}
</script>

<template>
  <AdminUser v-if="$route.params.page === 'users'" />
  <AdminToken v-else-if="$route.params.page === 'tokens'" />
  <AdminLicense v-else-if="$route.params.page === 'license'" />
  <span v-else></span>
</template>

<style scoped></style>
