<script setup lang="ts">
import type { FunctionalComponent, SVGAttributes } from 'vue'
import { useI18n } from 'vue-i18n'
import AuditTab from './AuditTab.vue'
import AppStore from './AppStore.vue'
import Metadata from './Metadata.vue'
import UIAcl from './UIAcl.vue'
import ApiTokenManagement from '~/components/tabs/auth/ApiTokenManagement.vue'
import UserManagement from '~/components/tabs/auth/UserManagement.vue'
import StoreFrontOutline from '~icons/mdi/storefront-outline'
import TeamFillIcon from '~icons/ri/team-fill'
import MultipleTableIcon from '~icons/mdi/table-multiple'
import NootbookOutline from '~icons/mdi/notebook-outline'
import { useVModel, useUIPermission, watch } from '#imports'

interface Props {
  modelValue: boolean
  openKey?: string
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

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emits)

const { isUIAllowed } = useUIPermission()

const { t } = useI18n()

const tabsInfo: TabGroup = {
  teamAndAuth: {
    title: 'Team and Auth',
    icon: TeamFillIcon,
    subTabs: {
      ...(isUIAllowed('userMgmtTab') && {
        usersManagement: {
          // Users Management
          title: t('title.userMgmt'),
          body: UserManagement,
        },
      }),
      ...(isUIAllowed('apiTokenTab') && {
        apiTokenManagement: {
          // API Tokens Management
          title: t('title.apiTokenMgmt'),
          body: ApiTokenManagement,
        },
      }),
    },
  },
  appStore: {
    title: 'App Store',
    icon: StoreFrontOutline,
    subTabs: {
      new: {
        title: 'Apps',
        body: AppStore,
      },
    },
  },
  metaData: {
    title: 'Project Metadata',
    icon: MultipleTableIcon,
    subTabs: {
      metaData: {
        title: 'Metadata',
        body: Metadata,
      },
      acl: {
        title: 'UI Access Control',
        body: UIAcl,
      },
    },
  },
  audit: {
    title: 'Audit',
    icon: NootbookOutline,
    subTabs: {
      audit: {
        title: 'Audit',
        body: AuditTab,
      },
    },
  },
}

const firstKeyOfObject = (obj: object) => Object.keys(obj)[0]

// Array of keys of tabs which are selected. In our case will be only one.
let selectedTabKeys = $ref<string[]>([firstKeyOfObject(tabsInfo)])
const selectedTab = $computed(() => tabsInfo[selectedTabKeys[0]])

let selectedSubTabKeys = $ref<string[]>([firstKeyOfObject(selectedTab.subTabs)])
const selectedSubTab = $computed(() => selectedTab.subTabs[selectedSubTabKeys[0]])

watch(
  () => selectedTabKeys[0],
  (newTabKey) => {
    selectedSubTabKeys = [firstKeyOfObject(tabsInfo[newTabKey].subTabs)]
  },
)

watch(
  () => props.openKey,
  (nextOpenKey) => {
    selectedTabKeys = [Object.keys(tabsInfo).find((key) => key === nextOpenKey) || firstKeyOfObject(tabsInfo)]
  },
)
</script>

<template>
  <a-modal v-model:visible="vModel" :footer="null" width="max(90vw, 600px)" @cancel="emits('update:modelValue', false)">
    <a-typography-title class="ml-4 mb-2 select-none" type="secondary" :level="5">SETTINGS</a-typography-title>

    <a-layout class="mt-3 modal-body flex">
      <!-- Side tabs -->
      <a-layout-sider theme="light">
        <a-menu v-model:selected-keys="selectedTabKeys" class="h-full" mode="inline" :open-keys="[]">
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
      <a-layout-content class="h-auto px-4 scrollbar-thumb-gray-500">
        <a-menu v-model:selectedKeys="selectedSubTabKeys" :open-keys="[]" mode="horizontal">
          <a-menu-item v-for="(tab, key) of selectedTab.subTabs" :key="key" class="select-none">
            {{ tab.title }}
          </a-menu-item>
        </a-menu>

        <component :is="selectedSubTab.body" class="px-2 py-6" />
      </a-layout-content>
    </a-layout>
  </a-modal>
</template>

<style scoped>
.modal-body {
  @apply h-[75vh];
  @apply overflow-y-auto;
}
</style>
