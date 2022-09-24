<script lang="ts" setup>
import AppStore from '~/components/dashboard/settings/AppStore.vue'
import { Role } from '~/lib'

definePageMeta({
  requiresAuth: true,
  allowedRoles: [Role.Super],
  title: 'title.appStore',
})
</script>

<template>
  <div class="p-10 h-full overflow-auto">
    <h1 class="text-3xl text-center mb-11 nc-app-store-title">{{ $t('title.appStore') }}</h1>
    <AppStore />
  </div>
</template>

<style scoped></style>
