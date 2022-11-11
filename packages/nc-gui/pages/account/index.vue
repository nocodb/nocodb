<script lang="ts" setup>
import { navigateTo } from '#imports'

const $route = useRoute()

// const selectedTabKeys = computed(() => [$route.params.page])
const selectedKeys = computed(() => [$route.params.nestedPage ?? $route.params.page])
const openKeys = ref([$route.params.nestedPage && 'users'])
</script>

<template>
  <div class="container mx-auto h-full">
    <a-layout class="h-full overflow-y-auto flex">
      <!-- Side tabs -->
      <a-layout-sider>
        <div class="pt-4 h-full bg-white nc-user-sidebar">
          <a-menu :inline-indent="12" v-model:openKeys="openKeys" v-model:selectedKeys="selectedKeys" class="tabs-menu h-full" mode="inline">
            <!--            <a-menu-item
                          key="users-old"
                          class="group active:(!ring-0) hover:(!bg-primary !bg-opacity-25)"
                          @click="navigateTo('/account/users')"
                        >
                          <div class="flex items-center space-x-2">
                            <MdiAccountSupervisorOutline />

                            <div class="select-none">User Management</div>
                          </div>
                        </a-menu-item> -->

            <a-sub-menu key="users" class="!bg-white">
              <template #icon>
                <MdiAccountSupervisorOutline />
              </template>
              <template #title>Users</template>
              <a-menu-item key="list" class="text-xs !pl-10" @click="navigateTo('/account/users/list')">User Management</a-menu-item>
              <a-menu-item key="settings" class="text-xs !pl-10" @click="navigateTo('/account/users/settings')">Settings</a-menu-item>
              <a-menu-item key="password-reset" class="text-xs !pl-10" @click="navigateTo('/account/users/password-reset')">
                Reset Password
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
        <NuxtPage />
      </a-layout-content>
    </a-layout>
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-user-sidebar .ant-menu-sub.ant-menu-inline) {
  @apply bg-transparent;
}
</style>
