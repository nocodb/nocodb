<script setup lang="ts">
import type { FunctionalComponent, SVGAttributes } from 'vue'
import AuditTab from './AuditTab.vue'
import AppStore from './AppStore.vue'
import StoreFrontOutline from '~icons/mdi/storefront-outline'
import TeamFillIcon from '~icons/ri/team-fill'
import MultipleTableIcon from '~icons/mdi/table-multiple'
import NootbookOutline from '~icons/mdi/notebook-outline'

interface Props {
  show: boolean
}

interface SubTabGroup {
  [key: string]: {
    title: string
    body: any
  }
}

interface TabGroup {
  [key: string]: {
    title: string
    icon: FunctionalComponent<SVGAttributes, {}>
    subTabs: SubTabGroup
  }
}

const { show } = defineProps<Props>()

const emits = defineEmits(['closed'])

const tabsInfo: TabGroup = {
  teamAndAuth: {
    title: 'Team and Auth',
    icon: TeamFillIcon,
    subTabs: {
      usersManagement: {
        title: 'Users Management',
        body: () => AuditTab,
      },
      apiTokenManagement: {
        title: 'API Token Management',
        body: () => AuditTab,
      },
    },
  },
  appStore: {
    title: 'App Store',
    icon: StoreFrontOutline,
    subTabs: {
      new: {
        title: 'Apps',
        body: () => AppStore,
      },
    },
  },
  metaData: {
    title: 'Project Metadata',
    icon: MultipleTableIcon,
    subTabs: {
      metaData: {
        title: 'Metadata',
        body: () => AuditTab,
      },
      acl: {
        title: 'UI Access Control',
        body: () => AuditTab,
      },
    },
  },
  audit: {
    title: 'Audit',
    icon: NootbookOutline,
    subTabs: {
      audit: {
        title: 'Audit',
        body: () => AuditTab,
      },
    },
  },
}

const firstKeyOfObject = (obj: object) => Object.keys(obj)[0]

// Array of keys of tabs which are selected. In our case will be only one.
const selectedTabKeys = $ref<string[]>([firstKeyOfObject(tabsInfo)])
const selectedTab = $computed(() => tabsInfo[selectedTabKeys[0]])

let selectedSubTabKeys = $ref<string[]>([firstKeyOfObject(selectedTab.subTabs)])
const selectedSubTab = $computed(() => selectedTab.subTabs[selectedSubTabKeys[0]])

watch(
  () => selectedTabKeys[0],
  (newTabKey) => {
    selectedSubTabKeys = [firstKeyOfObject(tabsInfo[newTabKey].subTabs)]
  },
)
</script>

<template>
  <a-modal :footer="null" :visible="show" width="max(90vw, 600px)" @cancel="emits('closed')">
    <a-typography-title class="ml-4 mb-2 select-none" type="secondary" :level="5">SETTINGS</a-typography-title>
    <a-layout class="mt-3 modal-body">
      <!-- Side tabs -->
      <a-layout-sider theme="light">
        <a-menu v-model:selectedKeys="selectedTabKeys" class="h-full" mode="inline" :open-keys="[]">
          <a-menu-item v-for="(tab, key) of tabsInfo" :key="key">
            <div class="flex flex-row items-center space-x-2">
              <component :is="tab.icon" class="flex" />
              <div class="flex select-none">
                {{ tab.title }}
              </div>
            </div>
          </a-menu-item>
        </a-menu>
      </a-layout-sider>

      <!-- Sub Tabs -->
      <a-layout-content class="h-full px-4 scrollbar-thumb-gray-500">
        <a-menu v-model:selectedKeys="selectedSubTabKeys" :open-keys="[]" mode="horizontal">
          <a-menu-item v-for="(tab, key) of selectedTab.subTabs" :key="key" class="select-none">
            {{ tab.title }}
          </a-menu-item>
        </a-menu>

        <component :is="selectedSubTab.body()" class="px-2 py-6" />
      </a-layout-content>
    </a-layout>
  </a-modal>
</template>

<style scoped>
.modal-body {
  @apply h-[70vh];
}
</style>
