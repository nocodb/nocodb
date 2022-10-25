<script setup lang="ts">
import { useUIPermission } from '~/composables/useUIPermission'

const { isUIAllowed } = useUIPermission()

const tabs = [
  ...(isUIAllowed('superAdminUserManagement')
    ? [
        { label: 'Users', key: 'list' },
        { label: 'Settings', key: 'settings' },
      ]
    : []),
  { label: 'Reset Password', key: 'password-reset' },
]

const $route = useRoute()

const selectedTabKey = computed({
  get() {
    return tabs.find((t) => t.key === $route.params.tabType)?.key ?? tabs[0].key
  },
  set(val) {
    navigateTo(`/account/users/${val}`)
  },
})
</script>

<template>
  <div class="h-full overflow-y-scroll scrollbar-thin-dull pt-4">
    <a-tabs v-model:active-key="selectedTabKey" :open-keys="[]" mode="horizontal" class="nc-auth-tabs">
      <a-tab-pane v-for="tab of tabs" :key="tab.key" class="select-none">
        <template #tab>
          <span>
            {{ tab.label }}
          </span>
        </template>
      </a-tab-pane>
    </a-tabs>
    <NuxtPage :tab-key="selectedTabKey" />
  </div>
</template>
