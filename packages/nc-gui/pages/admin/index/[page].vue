<template>
  <AdminUser v-if="$route.params.page === 'users'" />
  <AdminToken v-else-if="$route.params.page === 'tokens'" />
  <AdminLicense v-else-if="$route.params.page === 'license'" />
  <span v-else></span>
</template>

<script>
export default {
  name: 'index'
};
</script>

<style scoped>

</style>
