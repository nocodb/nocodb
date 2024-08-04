<script setup lang="ts">
import type { FunctionalComponent, SVGAttributes } from 'vue'
import Misc from './Misc.vue'
// import DataSources from '~/components/dashboard/settings/DataSources.vue'

interface Props {
  modelValue?: boolean
  openKey?: string
  dataSourcesState?: string
  baseId?: string
}

interface SubTabGroup {
  [key: string]: {
    key: string
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

const baseId = toRef(props, 'baseId')

const { isUIAllowed } = useRoles()

provide(ProjectIdInj, baseId)

const { $e } = useNuxtApp()

const { t } = useI18n()

const dataSourcesReload = ref(false)

const tabsInfo: TabGroup = {
  // teamAndAuth: {
  //   title: t('title.teamAndAuth'),
  //   icon: iconMap.users,
  //   subTabs: {
  //     ...(isUIAllowed('userMgmtTab')
  //       ? {
  //           usersManagement: {
  //             // Users Management
  //             title: t('title.userMgmt'),
  //             body: resolveComponent('TabsAuthUserManagement'),
  //           },
  //         }
  //       : {}),
  //     ...(isUIAllowed('apiTokenTab')
  //       ? {
  //           apiTokenManagement: {
  //             // API Tokens Management
  //             title: t('title.apiTokenMgmt'),
  //             body: resolveComponent('TabsAuthApiTokenManagement'),
  //           },
  //         }
  //       : {}),
  //   },
  //   onClick: () => {
  //     $e('c:settings:team-auth')
  //   },
  // },
  // audit: {
  //   // Audit
  //   title: t('title.audit'),
  //   icon: iconMap.book,
  //   subTabs: {
  //     audit: {
  //       // Audit
  //       title: t('title.audit'),
  //       body: resolveComponent('DashboardSettingsAuditTab'),
  //     },
  //   },
  //   onClick: () => {
  //     $e('c:settings:audit')
  //   },
  // },
  baseSettings: {
    // Base Settings
    title: t('labels.projectSettings'),
    icon: iconMap.settings,
    subTabs: {
      misc: {
        // Misc
        key: 'Misc',
        title: t('general.misc'),
        body: Misc,
      },
    },
    onClick: () => {
      $e('c:settings:base-settings')
    },
  },

  // dataSources: {
  //   // Data Sources
  //   title: 'Data Sources',
  //   icon: iconMap.database,
  //   subTabs: {
  //     dataSources: {
  //       title: 'Data Sources',
  //       body: DataSources,
  //     },
  //   },
  //   onClick: () => {
  //     vDataState.value = ''
  //     $e('c:settings:data-sources')
  //   },
  // },
}
const firstKeyOfObject = (obj: object) => Object.keys(obj)[0]

// Array of keys of tabs which are selected. In our case will be only one.
const selectedTabKeys = computed<string[]>({
  get: () => [Object.keys(tabsInfo).find((key) => key === vOpenKey.value) || firstKeyOfObject(tabsInfo)],
  set: (value) => {
    vOpenKey.value = value[0]
  },
})

const selectedTab = computed(() => tabsInfo[selectedTabKeys.value[0]])

const selectedSubTabKeys = ref<string[]>([firstKeyOfObject(selectedTab.value.subTabs)])
const selectedSubTab = computed(() => selectedTab.value.subTabs[selectedSubTabKeys.value[0]])

watch(
  () => selectedTabKeys.value[0],
  (newTabKey) => {
    selectedSubTabKeys.value = [firstKeyOfObject(tabsInfo[newTabKey].subTabs)]
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
    class="!top-50px !bottom-50px"
    wrap-class-name="nc-modal-settings"
    @cancel="emits('update:modelValue', false)"
  >
    <div class="nc-modal-settings-content">
      <!--    Settings -->
      <div class="flex flex-row justify-between w-full items-center p-4 border-b-1 border-gray-200">
        <h5 class="!my-0 text-2xl font-bold">{{ $t('objects.project') }} {{ $t('activity.settings') }}</h5>

        <NcButton type="text" size="small" data-testid="settings-modal-close-button" @click="vModel = false">
          <component :is="iconMap.close" class="cursor-pointer nc-modal-close w-4" />
        </NcButton>
      </div>

      <a-layout class="overflow-y-auto flex !h-[calc(100%_-_66px)]">
        <!-- Side tabs -->
        <a-layout-sider class="!bg-white">
          <a-menu v-model:selected-keys="selectedTabKeys" class="tabs-menu h-full" :open-keys="[]">
            <template v-for="(tab, key) of tabsInfo" :key="key">
              <a-menu-item
                v-if="key !== 'dataSources' || isUIAllowed('sourceCreate')"
                :key="key"
                class="active:(!ring-0) hover:(!bg-[#F0F3FF])"
              >
                <div class="flex items-center space-x-3 min-h-10" @click="tab.onClick">
                  <component :is="tab.icon" class="flex-none" />

                  <div class="select-none text-sm">
                    {{ tab.title }}
                  </div>
                </div>
              </a-menu-item>
            </template>
          </a-menu>
        </a-layout-sider>

        <!-- Sub Tabs -->
        <a-layout-content class="h-full scrollbar-thumb-gray-500">
          <a-menu
            v-if="selectedTabKeys[0] !== 'dataSources'"
            v-model:selectedKeys="selectedSubTabKeys"
            :open-keys="[]"
            mode="horizontal"
            class="px-4"
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

          <div
            class="overflow-auto"
            :class="{
              'h-full': selectedSubTabKeys[0] === 'dataSources',
              'px-4': selectedTabKeys[0] !== 'dataSources',
            }"
          >
            <component
              :is="selectedSubTab?.body"
              v-if="selectedSubTabKeys[0] === 'dataSources'"
              v-model:state="vDataState"
              v-model:reload="dataSourcesReload"
              class="h-full"
              :data-testid="`nc-settings-subtab-${selectedSubTab.key}`"
              :base-id="baseId"
            />
            <component
              :is="selectedSubTab?.body"
              v-else
              class="px-2 py-6"
              :base-id="baseId"
              :data-testid="`nc-settings-subtab-${selectedSubTab.key}`"
            />
          </div>
        </a-layout-content>
      </a-layout>
    </div>
  </a-modal>
</template>

<style lang="scss" scoped>
.tabs-menu {
  @apply !p-3;

  :deep(.ant-menu-item) {
    @apply rounded-lg first:!mt-0 !mb-1 font-weight-500;

    &.ant-menu-item-selected {
      @apply bg-[#F0F3FF] font-weight-600;
    }
  }
}
</style>

<style lang="scss">
.nc-modal-settings {
  .ant-modal-content {
    @apply !p-0 overflow-hidden;
  }

  .nc-modal-settings-content {
    height: min(calc(100vh - 100px), 1124px);
    max-height: min(calc(100vh - 100px), 1124px) !important;
  }
}
</style>
