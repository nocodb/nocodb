<script setup lang="ts">
import type { TabItem } from '~/composables'
import { TabMetaInj, provide, ref, useDialog, useNuxtApp, useTabs, useUIPermission } from '#imports'
import DlgTableCreate from '~/components/dlg/TableCreate.vue'
import DlgAirtableImport from '~/components/dlg/AirtableImport.vue'
import DlgQuickImport from '~/components/dlg/QuickImport.vue'
import { TabType } from '~/composables'
import MdiAirTableIcon from '~icons/mdi/table-large'
import MdiView from '~icons/mdi/eye-circle-outline'
import MdiAccountGroup from '~icons/mdi/account-group'

const { $e } = useNuxtApp()

const { tabs, activeTabIndex, activeTab, closeTab } = useTabs()

const { isUIAllowed } = useUIPermission()

const currentMenu = ref<string[]>(['addORImport'])

provide(TabMetaInj, activeTab)

const icon = (tab: TabItem) => {
  switch (tab.type) {
    case TabType.TABLE:
      return MdiAirTableIcon
    case TabType.VIEW:
      return MdiView
    case TabType.AUTH:
      return MdiAccountGroup
  }
}

function openQuickImportDialog(type: string) {
  $e(`a:actions:import-${type}`)

  const isOpen = ref(true)

  const { close } = useDialog(DlgQuickImport, {
    'modelValue': isOpen,
    'importType': type,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openTableCreateDialog() {
  $e('a:actions:create-table')

  const isOpen = ref(true)

  const { close } = useDialog(DlgTableCreate, {
    'modelValue': isOpen,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openAirtableImportDialog() {
  $e('a:actions:import-airtable')

  const isOpen = ref(true)

  const { close } = useDialog(DlgAirtableImport, {
    'modelValue': isOpen,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}
</script>

<template>
  <div class="h-full w-full nc-container pt-[9px]">
    <div class="h-full w-full flex flex-col">
      <div>
        <a-tabs v-model:activeKey="activeTabIndex" class="nc-root-tabs" type="editable-card" @edit="closeTab(activeTabIndex)">
          <a-tab-pane v-for="(tab, i) in tabs" :key="i">
            <template #tab>
              <div class="flex align-center gap-2">
                <component :is="icon(tab)" class="text-sm"></component>
                {{ tab.title }}
              </div>
            </template>
          </a-tab-pane>

          <template #leftExtra>
            <a-dropdown v-if="isUIAllowed('addOrImport')" :trigger="['click', 'hover']">
              <div
                class="cursor-pointer color-transition group hover:text-primary text-sm flex items-center gap-2 py-[9.5px] px-[20px]"
              >
                <MdiPlusBoxOutline class="group-hover:text-pink-500" />
                Add / Import
              </div>

              <template #overlay>
                <a-menu class="nc-add-project-menu !pt-0 ml-6">
                  <a-menu-item v-if="isUIAllowed('addTable')" key="add-new-table" @click="openTableCreateDialog">
                    <div class="color-transition nc-project-menu-item group">
                      <MdiTable class="group-hover:text-pink-500" />
                      <!-- Add new table -->
                      {{ $t('tooltip.addTable') }}
                    </div>
                  </a-menu-item>

                  <a-menu-item-group title="QUICK IMPORT FROM" class="!px-0 !mx-0">
                    <a-menu-item
                      v-if="isUIAllowed('airtableImport')"
                      key="quick-import-airtable"
                      @click="openAirtableImportDialog"
                    >
                      <div class="color-transition nc-project-menu-item group">
                        <MdiTableLarge class="group-hover:text-pink-500" />
                        <!-- TODO: i18n -->
                        Airtable
                      </div>
                    </a-menu-item>

                    <a-menu-item v-if="isUIAllowed('csvImport')" key="quick-import-csv" @click="openQuickImportDialog('csv')">
                      <div class="color-transition nc-project-menu-item group">
                        <MdiFileDocumentOutline class="group-hover:text-pink-500" />
                        <!-- TODO: i18n -->
                        CSV file
                      </div>
                    </a-menu-item>

                    <a-menu-item v-if="isUIAllowed('jsonImport')" key="quick-import-json" @click="openQuickImportDialog('json')">
                      <div class="color-transition nc-project-menu-item group">
                        <MdiCodeJson class="group-hover:text-pink-500" />
                        <!-- TODO: i18n -->
                        JSON file
                      </div>
                    </a-menu-item>

                    <a-menu-item
                      v-if="isUIAllowed('excelImport')"
                      key="quick-import-excel"
                      @click="openQuickImportDialog('excel')"
                    >
                      <div class="color-transition nc-project-menu-item group">
                        <MdiFileExcel class="group-hover:text-pink-500" />
                        <!-- TODO: i18n -->
                        Microsoft Excel
                      </div>
                    </a-menu-item>
                  </a-menu-item-group>

                  <a-menu-divider class="my-1" />

                  <a-menu-item v-if="isUIAllowed('importRequest')" key="add-new-table">
                    <a
                      v-t="['e:datasource:import-request']"
                      href="https://github.com/nocodb/nocodb/issues/2052"
                      target="_blank"
                      class="prose-sm pa-0 group"
                    >
                      <span class="flex items-center gap-2">
                        <MdiOpenInNew class="group-hover:text-pink-500" />
                        <!-- TODO: i18n -->
                        Request a data source you need?
                      </span>
                    </a>
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </template>
        </a-tabs>
      </div>

      <div class="w-full min-h-[300px] flex-auto">
        <NuxtPage />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-container {
  height: calc(100vh - var(--header-height));
  flex: 1 1 100%;
}

:deep(.nc-root-tabs) {
  & > .ant-tabs-nav {
    @apply !mb-0;

    & > .ant-tabs-nav-wrap > .ant-tabs-nav-list {
      & > .ant-tabs-nav-add {
        @apply !hidden;
      }

      & > .ant-tabs-tab-active {
        @apply font-weight-medium;
      }
      & > .ant-tabs-tab:not(.ant-tabs-tab-active) {
        @apply bg-gray-100 text-gray-500;
      }
    }
  }
}

.nc-add-project-menu {
  :deep(.ant-dropdown-menu-item-group-list) {
    @apply !mx-0;
  }
}

:deep(.ant-menu-item-selected) {
  @apply text-inherit !bg-inherit;
}

:deep(.ant-menu-horizontal),
:deep(.ant-menu-item::after),
:deep(.ant-menu-submenu::after) {
  @apply !border-none;
}
</style>
