<script setup lang="ts">
import useTabs from '~/composables/useTabs'
import MdiPlusIcon from '~icons/mdi/plus'
import MdiTableIcon from '~icons/mdi/table'
import MdiCsvIcon from '~icons/mdi/file-document-outline'
import MdiExcelIcon from '~icons/mdi/file-excel'
import MdiJSONIcon from '~icons/mdi/code-json'
import MdiAirTableIcon from '~icons/mdi/table-large'
import MdiRequestDataSourceIcon from '~icons/mdi/open-in-new'
import MdiAccountGroupIcon from '~icons/mdi/account-group'

const { tabs, activeTab, closeTab } = useTabs()
const { isUIAllowed } = useUIPermission()
const tableCreateDialog = ref(false)
const airtableImportDialog = ref(false)
const quickImportDialog = ref(false)
const importType = ref('')
const currentMenu = ref<string[]>(['addORImport'])

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
  <div>
    <a-tabs v-model:activeKey="activeTab" hide-add type="editable-card" :tab-position="top" @edit="onEdit">
      <a-tab-pane v-for="(tab, i) in tabs" :key="i" :value="i" class="text-capitalize" :closable="true">
        <template #tab>
          <span class="flex items-center gap-2">
            <MdiAccountGroupIcon v-if="tab.type === 'auth'" class="text-primary" />
            <MdiTableIcon v-else class="text-primary" />
            {{ tab.title }}
          </span>
        </template>
      </a-tab-pane>
      <template #leftExtra>
        <a-menu v-model:selectedKeys="currentMenu" mode="horizontal">
          <a-sub-menu key="addORImport">
            <template #title>
              <span class="flex items-center gap-2">
                <MdiPlusIcon />
                Add / Import
              </span>
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

    <DlgTableCreate v-if="tableCreateDialog" v-model="tableCreateDialog" />
    <DlgQuickImport v-if="quickImportDialog" v-model="quickImportDialog" :import-type="importType" />
    <DlgAirtableImport v-if="airtableImportDialog" v-model="airtableImportDialog" />

    <v-window v-model="activeTab">
      <v-window-item v-for="(tab, i) in tabs" :key="i" :value="i">
        <TabsAuth v-if="tab.type === 'auth'" :tab-meta="tab" />
        <TabsSmartsheet v-else :tab-meta="tab" />
      </v-window-item>
    </v-window>
  </div>
</template>

<style scoped lang="scss">
:deep(.ant-menu-item-group-list) .ant-menu-item {
  @apply m-0 pa-0 pl-4 pr-16;
}
</style>
