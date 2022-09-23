<script lang="ts" setup>
import AppStore from '~/components/dashboard/settings/AppStore.vue'
import { Role } from '~/lib'

definePageMeta({
  requiresAuth: true,
  allowedRoles: [Role.Super],
})
</script>

<template>
  <div class="p-4 h-full overflow-auto">
    <h1>{{ $t('label.appStore') }}</h1>
    <AppStore />
  </div>
</template>

<style scoped></style>
