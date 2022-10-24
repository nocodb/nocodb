<script setup lang="ts">
import type { ComputedRef } from 'vue'
import { computed, useI18n, useUIPermission } from '#imports'

interface Tab {
  title: string
  label: string
  isUIAllowed: ComputedRef<boolean>
}

const { t } = useI18n()

const { isUIAllowed } = useUIPermission()

const tabsInfo: Tab[] = [
  {
    title: 'Users Management',
    label: t('title.userMgmt'),
    isUIAllowed: computed(() => isUIAllowed('userMgmtTab')),
  },
  {
    title: 'API Token Management',
    label: t('title.apiTokenMgmt'),
    isUIAllowed: computed(() => isUIAllowed('apiTokenTab')),
  },
]

const selectedTabKey = $ref(0)

const selectedTab = $computed(() => tabsInfo[selectedTabKey])
</script>

<template>
  <div v-if="selectedTab.isUIAllowed">
    <a-tabs v-model:active-key="selectedTabKey" :open-keys="[]" mode="horizontal" class="nc-auth-tabs !mx-6">
      <a-tab-pane v-for="(tab, key) of tabsInfo" :key="key" class="select-none">
        <template #tab>
          <span>
            {{ tab.label }}
          </span>
        </template>
      </a-tab-pane>
    </a-tabs>

    <div class="mx-4 py-6 mt-2">
      <template v-if="selectedTabKey === 0">
        <LazyTabsAuthUserManagement />
      </template>

      <template v-else>
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
