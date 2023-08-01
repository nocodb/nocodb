<script lang="ts" setup>
import { Role } from '~/lib'
import { definePageMeta } from '#imports'

definePageMeta({
  requiresAuth: true,
  allowedRoles: [Role.Super],
  title: 'title.appStore',
})

useSidebar('nc-left-sidebar', { hasSidebar: false })
</script>

<template>
  <div class="p-10 h-full overflow-auto">
    <h1 class="text-3xl text-center mb-11 nc-app-store-title">{{ $t('title.appStore') }}</h1>

    <LazyDashboardSettingsAppStore />
  </div>
</template>
