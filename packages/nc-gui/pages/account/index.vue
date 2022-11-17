<script lang="ts" setup>
import { navigateTo, useUIPermission } from '#imports'

const { isUIAllowed } = useUIPermission()
const $route = useRoute()

const selectedKeys = computed(() => [
  /^\/account\/users\/?$/.test($route.fullPath)
    ? isUIAllowed('superAdminUserManagement')
      ? 'list'
      : 'settings'
    : $route.params.nestedPage ?? $route.params.page,
])
const openKeys = ref([/^\/account\/users/.test($route.fullPath) && 'users'])
</script>

<template>
  <div class="mx-auto h-full">
    <a-layout class="h-full overflow-y-auto flex">
      <!-- Side tabs -->
      <a-layout-sider>
        <div class="h-full bg-white nc-user-sidebar">
          <a-menu
            v-model:openKeys="openKeys"
            v-model:selectedKeys="selectedKeys"
            :inline-indent="16"
            class="tabs-menu h-full"
            mode="inline"
          >
            <div class="text-xs text-gray-500 ml-4 pt-4 pb-2 font-weight-bold">Account Settings</div>

            <a-sub-menu key="users" class="!bg-white">
              <template #icon>
                <MdiAccountSupervisorOutline />
              </template>
              <template #title>Users</template>

              <a-menu-item
                v-if="isUIAllowed('superAdminUserManagement')"
                key="list"
                class="text-xs"
                @click="navigateTo('/account/users/list')"
              >
                <span class="ml-4">User Management</span>
              </a-menu-item>
              <a-menu-item key="password-reset" class="text-xs" @click="navigateTo('/account/users/password-reset')">
                <span class="ml-4">Reset Password</span>
              </a-menu-item>
              <a-menu-item
                v-if="isUIAllowed('superAdminAppSettings')"
                key="settings"
                class="text-xs"
                @click="navigateTo('/account/users/settings')"
              >
                <span class="ml-4">Settings</span>
              </a-menu-item>
            </a-sub-menu>

            <a-menu-item
              key="tokens"
              class="group active:(!ring-0) hover:(!bg-primary !bg-opacity-25)"
              @click="navigateTo('/account/tokens')"
            >
              <div class="flex items-center space-x-2">
                <MdiShieldKeyOutline />

                <div class="select-none">Tokens</div>
              </div>
            </a-menu-item>
            <a-menu-item
              key="apps"
              class="group active:(!ring-0) hover:(!bg-primary !bg-opacity-25)"
              @click="navigateTo('/account/apps')"
            >
              <div class="flex items-center space-x-2">
                <MdiStorefrontOutline />

                <div class="select-none">App Store</div>
              </div>
            </a-menu-item>
          </a-menu>
        </div>
      </a-layout-sider>

      <!-- Sub Tabs -->
      <a-layout-content class="h-auto px-4 scrollbar-thumb-gray-500">
        <div class="container mx-auto">
          <NuxtPage />
        </div>
      </a-layout-content>
    </a-layout>
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-user-sidebar .ant-menu-sub.ant-menu-inline) {
  @apply bg-transparent;
}

:deep(.nc-user-sidebar .ant-menu-item-only-child),
:deep(.ant-menu-submenu-title) {
  @apply !h-[30px] !leading-[30px];
}

:deep(.ant-menu-submenu-arrow) {
  @apply !text-gray-400;
}

:deep(.ant-menu-submenu-selected .ant-menu-submenu-arrow) {
  @apply !text-inherit;
}
</style>
