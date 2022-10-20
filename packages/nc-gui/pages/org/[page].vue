<template>
  <a-layout class="mt-3 h-[75vh] overflow-y-auto flex">
    <!-- Side tabs -->
    <a-layout-sider>
      <a-menu :selected-keys="selectedTabKeys" class="tabs-menu h-full" :open-keys="[]">
        <a-menu-item
          key="users"
          @click="navigateTo('/org/users')"
          class="group active:(!ring-0) hover:(!bg-primary !bg-opacity-25)"
        >
          <div class="flex items-center space-x-2">
            <MdiAccountSupervisorOutline/>

            <div class="select-none">
              Users
            </div>
          </div>
        </a-menu-item>
        <a-menu-item
          key="tokens"
          @click="navigateTo('/org/tokens')"
          class="group active:(!ring-0) hover:(!bg-primary !bg-opacity-25)"
        >
          <div class="flex items-center space-x-2">
            <MdiShieldKeyOutline/>

            <div class="select-none">
              Tokens
            </div>
          </div>
        </a-menu-item>
      </a-menu>
    </a-layout-sider>

    <!-- Sub Tabs -->
    <a-layout-content class="h-auto px-4 scrollbar-thumb-gray-500">

      <OrgUser v-if="$route.params.page === 'users'" />
      <OrgToken v-else-if="$route.params.page === 'tokens'" />
    </a-layout-content>
  </a-layout>
</template>

<script lang="ts" setup>
import { navigateTo } from '#imports'

const $route = useRoute()
const selectedTabKeys = computed(() => [$route.params.page])
</script>
