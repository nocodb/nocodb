<script lang="ts" setup>
import { useUIPermission } from '~/composables/useUIPermission'

const { isUIAllowed } = useUIPermission()

const tabs = [
  ...(isUIAllowed('superAdminUserManagement')
    ? [
        { label: 'Users', key: 'users' },
        { label: 'Settings', key: 'settings' },
      ]
    : []),
  { label: 'Reset Password', key: 'password-reset' },
]

const selectedTabKey = ref(tabs[0].key)
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
    <template v-if="selectedTabKey === 'users'">
      <LazyAccountUserList />
    </template>
    <template v-else-if="selectedTabKey === 'settings'">
      <LazyAccountSignupSettings />
    </template>
    <template v-else-if="selectedTabKey === 'password-reset'">
      <LazyAccountResetPassword />
    </template>
  </div>
</template>

<style scoped></style>
