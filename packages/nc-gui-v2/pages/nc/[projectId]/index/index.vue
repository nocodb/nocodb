<script setup lang="ts">
import { TabMetaInj } from '~/context'
import { useTabs, useUIPermission } from '#imports'
import MdiPlusIcon from '~icons/mdi/plus'
import MdiTableIcon from '~icons/mdi/table'
import MdiCsvIcon from '~icons/mdi/file-document-outline'
import MdiExcelIcon from '~icons/mdi/file-excel'
import MdiJSONIcon from '~icons/mdi/code-json'
import MdiAirTableIcon from '~icons/mdi/table-large'
import MdiRequestDataSourceIcon from '~icons/mdi/open-in-new'

const { tabs, activeTabIndex, activeTab, closeTab } = useTabs()

const { isUIAllowed } = useUIPermission()

const tableCreateDialog = ref(false)
const airtableImportDialog = ref(false)
const quickImportDialog = ref(false)
const importType = ref('')
const currentMenu = ref<string[]>(['addORImport'])

provide(TabMetaInj, activeTab)

function onEdit(targetKey: number, action: string) {
  if (action !== 'add') {
    closeTab(targetKey)
  }
}

function openQuickImportDialog(type: string) {
  quickImportDialog.value = true
  importType.value = type
}
</script>

<template>
  <div class="flex w-full h-full">
    <div class="nc-container flex flex-col">
      <div>
        <a-tabs v-model:activeKey="activeTabIndex" type="editable-card" @edit="closeTab">
          <a-tab-pane v-for="(tab, i) in tabs" :key="i" :tab="tab.title" />

          <template #leftExtra>
            <a-menu v-model:selectedKeys="currentMenu" class="border-0" mode="horizontal">
              <a-sub-menu key="addORImport">
                <template #title>
                  <div class="text-sm flex items-center gap-2">
                    <MdiPlusIcon />
                    Add / Import
                  </div>
                </template>
                <a-menu-item-group v-if="isUIAllowed('addTable')">
                  <a-menu-item key="add-new-table" v-t="['a:actions:create-table']" @click="tableCreateDialog = true">
                    <span class="flex items-center gap-2">
                      <MdiTableIcon class="text-primary" />
                      <!-- Add new table -->
                      {{ $t('tooltip.addTable') }}
                    </span>
                  </a-menu-item>
                </a-menu-item-group>
                <a-menu-item-group title="QUICK IMPORT FROM">
                  <a-menu-item
                    v-if="isUIAllowed('airtableImport')"
                    key="quick-import-airtable"
                    v-t="['a:actions:import-airtable']"
                    @click="airtableImportDialog = true"
                  >
                    <span class="flex items-center gap-2">
                      <MdiAirTableIcon class="text-primary" />
                      <!-- TODO: i18n -->
                      Airtable
                    </span>
                  </a-menu-item>
                  <a-menu-item
                    v-if="isUIAllowed('csvImport')"
                    key="quick-import-csv"
                    v-t="['a:actions:import-csv']"
                    @click="openQuickImportDialog('csv')"
                  >
                    <span class="flex items-center gap-2">
                      <MdiCsvIcon class="text-primary" />
                      <!-- TODO: i18n -->
                      CSV file
                    </span>
                  </a-menu-item>
                  <a-menu-item
                    v-if="isUIAllowed('jsonImport')"
                    key="quick-import-json"
                    v-t="['a:actions:import-json']"
                    @click="openQuickImportDialog('json')"
                  >
                    <span class="flex items-center gap-2">
                      <MdiJSONIcon class="text-primary" />
                      <!-- TODO: i18n -->
                      JSON file
                    </span>
                  </a-menu-item>
                  <a-menu-item
                    v-if="isUIAllowed('excelImport')"
                    key="quick-import-excel"
                    v-t="['a:actions:import-excel']"
                    @click="openQuickImportDialog('excel')"
                  >
                    <span class="flex items-center gap-2">
                      <MdiExcelIcon class="text-primary" />
                      <!-- TODO: i18n -->
                      Microsoft Excel
                    </span>
                  </a-menu-item>
                </a-menu-item-group>
                <a-divider class="ma-0 mb-2" />
                <a-menu-item
                  v-if="isUIAllowed('importRequest')"
                  key="add-new-table"
                  v-t="['e:datasource:import-request']"
                  class="ma-0 mt-3"
                >
                  <a href="https://github.com/nocodb/nocodb/issues/2052" target="_blank" class="prose-sm pa-0">
                    <span class="flex items-center gap-2">
                      <MdiRequestDataSourceIcon class="text-primary" />
                      <!-- TODO: i18n -->
                      Request a data source you need?
                    </span>
                  </a>
                </a-menu-item>
              </a-sub-menu>
            </a-menu>
          </template>
        </a-tabs>
      </div>

      <div class="flex-1 min-h-0">
        <NuxtPage />
      </div>

      <DlgTableCreate v-if="tableCreateDialog" v-model="tableCreateDialog" />
      <DlgQuickImport v-if="quickImportDialog" v-model="quickImportDialog" :import-type="importType" />
      <DlgAirtableImport v-if="airtableImportDialog" v-model="airtableImportDialog" />
    </div>

    <div id="sidebar-right" class="h-full" />
  </div>
</template>

<style scoped>
.nc-container {
  height: calc(100vh - var(--header-height) - 8px);
  @apply overflow-hidden;
  flex: 1 1 100%;
}

:deep(.ant-tabs-nav) {
  @apply !mb-0;
}
</style>
