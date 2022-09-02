<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import UserManagement from './auth/UserManagement.vue'
import ApiTokenManagement from './auth/ApiTokenManagement.vue'

interface Tab {
  title: string
  body: any
}
const { t } = useI18n()
const tabsInfo: Tab[] = [
  {
    title: 'Users Management',
    label: t('title.userMgmt'),
    body: () => UserManagement,
  },
  {
    title: 'API Token Management',
    label: t('title.userMgmt'),
    body: () => ApiTokenManagement,
  },
]

// const firstKeyOfObject = (obj: object) => Object.keys(obj)[0]

const selectedTabKey = $ref(0)
const selectedTab = $computed(() => tabsInfo[selectedTabKey])
</script>

<template>
  <div>
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
      <component :is="selectedTab.body()" />
    </div>
  </div>
</template>

<style scoped>
:deep(.nc-auth-tabs .ant-tabs-nav::before) {
  @apply !border-none;
}
</style>
