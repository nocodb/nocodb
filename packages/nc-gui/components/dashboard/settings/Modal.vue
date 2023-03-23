<script setup lang="ts">
import type { FunctionalComponent, SVGAttributes } from 'vue'
import DataSources from './DataSources.vue'
import Misc from './Misc.vue'
import { DataSourcesSubTab, iconMap, useI18n, useNuxtApp, useUIPermission, useVModel, watch } from '#imports'

interface Props {
  modelValue: boolean
  openKey: string
  dataSourcesState: string
}

interface SubTabGroup {
  [key: string]: {
    title: string
    body: any
    onClick?: () => void
  }
}

interface TabGroup {
  [key: string]: {
    title: string
    icon: FunctionalComponent<SVGAttributes, {}>
    subTabs: SubTabGroup
    onClick?: () => void
  }
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue', 'update:openKey', 'update:dataSourcesState'])

const vModel = useVModel(props, 'modelValue', emits)

const vOpenKey = useVModel(props, 'openKey', emits)

const vDataState = useVModel(props, 'dataSourcesState', emits)

const { isUIAllowed } = useUIPermission()

const { t } = useI18n()

const { $e } = useNuxtApp()

const dataSourcesReload = ref(false)

const dataSourcesAwakened = ref(false)

const tabsInfo: TabGroup = {
  teamAndAuth: {
    title: t('title.teamAndAuth'),
    icon: iconMap.users,
    subTabs: {
      ...(isUIAllowed('userMgmtTab')
        ? {
            usersManagement: {
              // Users Management
              title: t('title.userMgmt'),
              body: resolveComponent('TabsAuthUserManagement'),
            },
          }
        : {}),
      ...(isUIAllowed('apiTokenTab')
        ? {
            apiTokenManagement: {
              // API Tokens Management
              title: t('title.apiTokenMgmt'),
              body: resolveComponent('TabsAuthApiTokenManagement'),
            },
          }
        : {}),
    },
    onClick: () => {
      $e('c:settings:team-auth')
    },
  },
  dataSources: {
    // Data Sources
    title: 'Data Sources',
    icon: iconMap.datasource,
    subTabs: {
      dataSources: {
        title: 'Data Sources',
        body: DataSources,
      },
    },
    onClick: () => {
      vDataState.value = ''
      $e('c:settings:data-sources')
    },
  },
  audit: {
    // Audit
    title: t('title.audit'),
    icon: iconMap.book,
    subTabs: {
      audit: {
        // Audit
        title: t('title.audit'),
        body: resolveComponent('DashboardSettingsAuditTab'),
      },
    },
    onClick: () => {
      $e('c:settings:audit')
    },
  },
  projectSettings: {
    // Project Settings
    title: 'Project Settings',
    icon: iconMap.settings,
    subTabs: {
      misc: {
        // Misc
        title: 'Misc',
        body: Misc,
      },
    },
    onClick: () => {
      $e('c:settings:project-settings')
    },
  },
}
const firstKeyOfObject = (obj: object) => Object.keys(obj)[0]

// Array of keys of tabs which are selected. In our case will be only one.
const selectedTabKeys = $computed<string[]>({
  get: () => [Object.keys(tabsInfo).find((key) => key === vOpenKey.value) || firstKeyOfObject(tabsInfo)],
  set: (value) => {
    vOpenKey.value = value[0]
  },
})

const selectedTab = $computed(() => tabsInfo[selectedTabKeys[0]])

let selectedSubTabKeys = $ref<string[]>([firstKeyOfObject(selectedTab.subTabs)])
const selectedSubTab = $computed(() => selectedTab.subTabs[selectedSubTabKeys[0]])

const handleAwaken = (val: boolean) => {
  dataSourcesAwakened.value = val
}

watch(
  () => selectedTabKeys[0],
  (newTabKey) => {
    selectedSubTabKeys = [firstKeyOfObject(tabsInfo[newTabKey].subTabs)]
  },
)
</script>

<template>
  <a-modal
    v-model:visible="vModel"
    :class="{ active: vModel }"
    :footer="null"
    width="max(90vw, 600px)"
    :closable="false"
    wrap-class-name="nc-modal-settings"
    @cancel="emits('update:modelValue', false)"
  >
    <!--    Settings -->
    <div class="flex flex-row justify-between w-full items-center mb-1">
      <a-typography-title class="ml-4 select-none" type="secondary" :level="5">
        {{ $t('activity.settings') }}
      </a-typography-title>

      <a-button
        type="text"
        class="!rounded-md border-none !px-1.5"
        data-testid="settings-modal-close-button"
        @click="vModel = false"
      >
        <MdiClose class="cursor-pointer nc-modal-close w-4" />
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
            <div class="flex items-center space-x-2" @click="tab.onClick">
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
        <a-menu
          v-if="selectedTabKeys[0] !== 'dataSources'"
          v-model:selectedKeys="selectedSubTabKeys"
          :open-keys="[]"
          mode="horizontal"
        >
          <a-menu-item
            v-for="(tab, key) of selectedTab.subTabs"
            :key="key"
            class="active:(!ring-0) select-none"
            @click="tab.onClick"
          >
            {{ tab.title }}
          </a-menu-item>
        </a-menu>
        <div v-else>
          <div class="flex items-center">
            <a-breadcrumb class="w-full cursor-pointer">
              <a-breadcrumb-item v-if="vDataState !== ''" @click="vDataState = ''">
                <a class="!no-underline">Data Sources</a>
              </a-breadcrumb-item>
              <a-breadcrumb-item v-else @click="vDataState = ''">Data Sources</a-breadcrumb-item>
              <a-breadcrumb-item v-if="vDataState !== ''">{{ vDataState }}</a-breadcrumb-item>
            </a-breadcrumb>
            <div v-if="vDataState === ''" class="flex flex-row justify-end items-center w-full gap-1">
              <a-button
                v-if="dataSourcesAwakened"
                class="self-start nc-btn-new-datasource"
                @click="vDataState = DataSourcesSubTab.New"
              >
                <div v-if="vDataState === ''" class="flex items-center gap-2 text-primary font-light">
                  <MdiDatabasePlusOutline class="text-lg group-hover:text-accent" />
                  New
                </div>
              </a-button>
              <!--        Reload -->
              <a-button
                v-e="['a:proj-meta:data-sources:reload']"
                class="self-start nc-btn-metasync-reload"
                @click="dataSourcesReload = true"
              >
                <div class="flex items-center gap-2 text-gray-600 font-light">
                  <component :is="iconMap.reload" :class="{ 'animate-infinite animate-spin !text-success': dataSourcesReload }" />
                  {{ $t('general.reload') }}
                </div>
              </a-button>
            </div>
          </div>
          <a-divider style="margin: 10px 0" />
        </div>

        <div class="h-[600px]">
          <component
            :is="selectedSubTab?.body"
            v-if="selectedSubTabKeys[0] === 'dataSources'"
            v-model:state="vDataState"
            v-model:reload="dataSourcesReload"
            class="px-2 pb-2"
            :data-testid="`nc-settings-subtab-${selectedSubTab.title}`"
            @awaken="handleAwaken"
          />
          <component
            :is="selectedSubTab?.body"
            v-else
            class="px-2 py-6"
            :data-testid="`nc-settings-subtab-${selectedSubTab.title}`"
          />
        </div>
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
