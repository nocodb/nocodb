<script setup lang="ts">
import type { ComputedRef } from 'vue'
import { computed, useI18n, useUIPermission } from '#imports'

interface Tab {
  title: string
  label: string
  isUIAllowed: ComputedRef<boolean>
  key: string
}

const { t } = useI18n()

const { isUIAllowed } = useUIPermission()

const tabsInfo: Tab[] = [
  {
    title: 'Users Management',
    label: t('title.userMgmt'),
    isUIAllowed: computed(() => isUIAllowed('userMgmtTab')),
    key: 'userMgmtTab'
  },
  {
    title: 'API Token Management',
    label: t('title.apiTokenMgmt'),
    isUIAllowed: computed(() => isUIAllowed('apiTokenTab')),
    key: 'apiTokenTab'
  },
]

const visibleTabs = $computed(() => tabsInfo.filter(tab => tab.isUIAllowed.value))

const selectedTabKey = $ref(visibleTabs?.[0].key)

</script>

<template v-if="visibleTabs.length > 0">
  <div>
    <a-tabs v-model:active-key="selectedTabKey" :open-keys="[]" mode="horizontal" class="nc-auth-tabs !mx-6">
      <a-tab-pane v-for="(tab) of visibleTabs" :key="tab.key" class="select-none">
        <template #tab>
          <span>
            {{ tab.label }}
          </span>
        </template>
      </a-tab-pane>
    </a-tabs>

    <div class="mx-4 py-6 mt-2">
      <template v-if="selectedTabKey === 'userMgmtTab'">
        <LazyTabsAuthUserManagement />
      </template>

      <template v-else-if="selectedTabKey === 'apiTokenTab'">
        <LazyTabsAuthApiTokenManagement />
      </template>
    </div>
  </div>
</template>

<style scoped>
:deep(.nc-auth-tabs .ant-tabs-nav::before) {
  @apply !border-none;
}
</style>
