<script setup lang="ts">
import UserManagement from './auth/UserManagement.vue'
import ApiTokenManagement from './auth/ApiTokenManagement.vue'

interface Tab {
  title: string
  body: any
}

const tabsInfo: Tab[] = [
  {
    title: 'Users Management',
    body: () => UserManagement,
  },
  {
    title: 'API Token Management',
    body: () => ApiTokenManagement,
  },
]

// const firstKeyOfObject = (obj: object) => Object.keys(obj)[0]

const selectedTabKey = $ref(0)
const selectedTab = $computed(() => tabsInfo[selectedTabKey])
</script>

<template>
  <div>
    <a-tabs v-model:active-key="selectedTabKey" class="" :open-keys="[]" mode="horizontal">
      <a-tabs-tab-pane v-for="(tab, key) of tabsInfo" :key="key" class="select-none">
        <template #tab>
          <span class="mx-3">
            {{ tab.title }}
          </span>
        </template>
      </a-tabs-tab-pane>
    </a-tabs>

    <div class="mx-4 py-6 mt-2">
      <component :is="selectedTab.body()" />
    </div>
  </div>
</template>
