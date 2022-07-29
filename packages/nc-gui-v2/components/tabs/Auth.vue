<script setup lang="ts">
import UserManagement from './auth/UserManagement.vue'
import ApiTokenManagement from './auth/ApiTokenManagement.vue'

interface TabGroup {
  [key: string]: {
    title: string
    body: any
  }
}

const tabsInfo: TabGroup = {
  usersManagement: {
    title: 'Users Management',
    body: () => UserManagement,
  },
  apiTokenManagement: {
    title: 'API Token Management',
    body: () => ApiTokenManagement,
  },
}

const firstKeyOfObject = (obj: object) => Object.keys(obj)[0]

const selectedTabKeys = $ref<string[]>([firstKeyOfObject(tabsInfo)])
const selectedTab = $computed(() => tabsInfo[selectedTabKeys[0]])
</script>

<template>
  <div class="mt-2">
    <a-menu v-model:selectedKeys="selectedTabKeys" :open-keys="[]" mode="horizontal">
      <a-menu-item v-for="(tab, key) of tabsInfo" :key="key" class="select-none">
        <div class="text-xs pb-2.5">
          {{ tab.title }}
        </div>
      </a-menu-item>
    </a-menu>

    <div class="mx-4 py-6 mt-2">
      <component :is="selectedTab.body()" />
    </div>
  </div>
</template>
