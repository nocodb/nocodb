<script setup lang="ts">
import type { FunctionalComponent, SVGAttributes } from 'vue'
import AuditTab from './AuditTab.vue'
import AppStore from './AppStore.vue'
import Metadata from './Metadata.vue'
import UIAcl from './UIAcl.vue'
import Misc from './Misc.vue'
import { useI18n, useUIPermission, useVModel, watch } from '#imports'
import ApiTokenManagement from '~/components/tabs/auth/ApiTokenManagement.vue'
import UserManagement from '~/components/tabs/auth/UserManagement.vue'
import StoreFrontOutline from '~icons/mdi/storefront-outline'
import TeamFillIcon from '~icons/ri/team-fill'
import MultipleTableIcon from '~icons/mdi/table-multiple'
import NootbookOutline from '~icons/mdi/notebook-outline'

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
      misc: {
        title: 'Misc',
        body: Misc,
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
  <a-modal
    v-model:visible="vModel"
    :footer="null"
    width="max(90vw, 600px)"
    :closable="false"
    @cancel="emits('update:modelValue', false)"
  >
    <div class="flex flex-row justify-between w-full items-center mb-1">
      <a-typography-title class="ml-4 select-none" type="secondary" :level="5">SETTINGS</a-typography-title>
      <a-button type="text" class="!rounded-md border-none -mt-1.5 -mr-1" @click="vModel = false">
        <template #icon>
          <MdiClose class="cursor-pointer mt-1 nc-modal-close" />
        </template>
      </a-button>
    </div>

    <a-layout class="mt-3 h-[75vh] overflow-y-auto flex">
      <!-- Side tabs -->
      <a-layout-sider>
        <a-menu v-model:selected-keys="selectedTabKeys" class="tabs-menu h-full" :open-keys="[]">
          <a-menu-item
            v-for="(tab, key) of tabsInfo"
            :key="key"
            class="group active:(!ring-0) hover:(!bg-primary !bg-opacity-25)"
          >
            <div class="flex items-center space-x-2">
              <component :is="tab.icon" class="group-hover:text-accent" />

              <div class="select-none">
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

<style lang="scss" scoped>
.tabs-menu {
  :deep(.ant-menu-item-selected) {
    @apply border-r-3 border-primary bg-primary !bg-opacity-25;
  }
}
</style>
