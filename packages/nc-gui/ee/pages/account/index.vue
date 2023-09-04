<script lang="ts" setup>
import { iconMap, navigateTo, useUIPermission } from '#imports'

const { isUIAllowed } = useUIPermission()

const $route = useRoute()

const { appInfo } = useGlobal()

const { loadScope } = useCommandPalette()

loadScope('account_settings')

const selectedKeys = computed(() => {
  if (/^\/account\/users\/?$/.test($route.fullPath)) {
    if (isUIAllowed('superAdminUserManagement')) return ['list']
    if (!appInfo.value.disableEmailAuth) return ['settings']
    return ['tokens']
  }
  return [$route.params.nestedPage ?? $route.params.page]
})

const openKeys = ref([/^\/account\/users/.test($route.fullPath) && 'users'])
</script>

<template>
  <div class="mx-auto h-full">
    <a-layout class="h-full overflow-y-auto flex">
      <!-- Side tabs -->
      <a-layout-sider>
        <div class="h-full bg-white nc-user-sidebar">
          <NcMenu
            v-model:openKeys="openKeys"
            v-model:selectedKeys="selectedKeys"
            :inline-indent="16"
            class="tabs-menu h-full"
            mode="inline"
          >
            <div class="text-xs text-gray-600 ml-4 py-1.5">{{ $t('labels.account') }}</div>

            <a-sub-menu
              v-if="!appInfo.disableEmailAuth || isUIAllowed('superAdminAppSettings')"
              key="users"
              class="!bg-white !my-0"
            >
              <template #icon>
                <MdiAccountSupervisorOutline />
              </template>
              <template #title>Users</template>

              <NcMenuItem
                v-if="isUIAllowed('superAdminUserManagement')"
                key="list"
                class="text-xs group"
                :class="{
                  active: $route.params.nestedPage === 'list',
                }"
                @click="navigateTo('/account/users/list')"
              >
                <span class="ml-4">{{ $t('title.userManagement') }}</span>
              </NcMenuItem>
              <NcMenuItem
                key="password-reset"
                class="text-xs group"
                :class="{
                  active: $route.params.nestedPage === 'password-reset',
                }"
                @click="navigateTo('/account/users/password-reset')"
              >
                <span class="ml-4">{{ $t('title.resetPasswordMenu') }}</span>
              </NcMenuItem>
              <NcMenuItem
                v-if="isUIAllowed('superAdminAppSettings')"
                key="settings"
                class="text-xs group"
                :class="{
                  active: $route.params.nestedPage === 'settings',
                }"
                @click="navigateTo('/account/users/settings')"
              >
                <span class="ml-4">{{ $t('activity.settings') }}</span>
              </NcMenuItem>
            </a-sub-menu>

            <NcMenuItem
              key="tokens"
              class="group"
              :class="{
                active: $route.params.page === 'tokens',
              }"
              @click="navigateTo('/account/tokens')"
            >
              <div class="flex items-center space-x-2">
                <MdiShieldKeyOutline />

                <div class="select-none">{{ $t('title.tokens') }}</div>
              </div>
            </NcMenuItem>
            <NcMenuItem
              v-if="isUIAllowed('appStore') && !appInfo.isCloud"
              key="apps"
              class="group"
              :class="{
                active: $route.params.page === 'apps',
              }"
              @click="navigateTo('/account/apps')"
            >
              <div class="flex items-center space-x-2">
                <component :is="iconMap.appStore" />

                <div class="select-none text-sm">{{ $t('title.appStore') }}</div>
              </div>
            </NcMenuItem>
          </NcMenu>
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

:deep(.group) {
  @apply select-none mx-2 w-46 !px-3 !text-sm !rounded-md !mb-1 !hover:(bg-brand-50 text-brand-500);
}

:deep(.active) {
  @apply !bg-brand-50 !text-brand-500;
}

:deep(.ant-menu-submenu-title) {
  @apply select-none mx-2 w-46 !px-3 !text-sm !rounded-md !mb-1 !hover:(bg-brand-50 text-brand-500);
}

:deep(.ant-menu) {
  @apply !pt-0 !rounded-none !border-gray-200;
}
</style>
