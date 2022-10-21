<script lang="ts" setup>
import { navigateTo } from '#imports'
const $route = useRoute()
const selectedTabKeys = computed(() => [$route.params.page])
</script>

<template>
  <div class="container mx-auto h-full">
    <a-layout class="h-full overflow-y-auto flex">
      <!-- Side tabs -->
      <a-layout-sider>
        <div class="pt-4 h-full bg-white">
          <a-menu :selected-keys="selectedTabKeys" class="tabs-menu h-full" :open-keys="[]">
            <a-menu-item
              key="users"
              class="group active:(!ring-0) hover:(!bg-primary !bg-opacity-25)"
              @click="navigateTo('/admin/users')"
            >
              <div class="flex items-center space-x-2">
                <MdiAccountSupervisorOutline />

                <div class="select-none">User Management</div>
              </div>
            </a-menu-item>
            <a-menu-item
              key="tokens"
              class="group active:(!ring-0) hover:(!bg-primary !bg-opacity-25)"
              @click="navigateTo('/admin/tokens')"
            >
              <div class="flex items-center space-x-2">
                <MdiShieldKeyOutline />

                <div class="select-none">Tokens</div>
              </div>
            </a-menu-item>
            <a-menu-item
              key="license"
              class="group active:(!ring-0) hover:(!bg-primary !bg-opacity-25)"
              @click="navigateTo('/admin/license')"
            >
              <div class="flex items-center space-x-2">
                <MdiKeyChainVariant />
                <div class="select-none">License</div>
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
