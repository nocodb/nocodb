<script setup lang="ts">
import useTabs from '~/composables/useTabs'
import MdiCloseIcon from '~icons/mdi/close'
import MdiPlusIcon from '~icons/mdi/plus'
import MdiTableIcon from '~icons/mdi/table'
import MdiCsvIcon from '~icons/mdi/file-document-outline'
import MdiExcelIcon from '~icons/mdi/file-excel'
import MdiJSONIcon from '~icons/mdi/code-json'
import MdiAirTableIcon from '~icons/mdi/table-large'
import MdiRequestDataSourceIcon from '~icons/mdi/open-in-new'

const { tabs, activeTab, closeTab } = useTabs()
// TODO: use useUIPermission when it's ready
// const { isUIAllowed } = useUIPermission()
const isUIAllowed = (x: string) => true
const tableCreateDialog = ref(false)
const currentMenu = ref<string[]>(['addORImport'])

const onEdit = (targetKey: number, action: string) => {
  if (action !== 'add') {
    closeTab(targetKey)
  }
}
</script>

<template>
  <div>
    <a-tabs v-model:activeKey="activeTab" hide-add type="editable-card" :tab-position="top" @edit="onEdit">
      <a-tab-pane v-for="(tab, i) in tabs" :key="i" :value="i" class="text-capitalize" :closable="true">
        <template #tab>
          <span>
            <MdiTableIcon class="text-primary mdi-icons" />
            {{ tab.title }}
          </span>
        </template>
      </a-tab-pane>

      <template #leftExtra>
        <a-menu v-model:selectedKeys="currentMenu" mode="horizontal">
          <a-sub-menu key="addORImport">
            <template #title>
              <span>
                <MdiPlusIcon class="mdi-icons" />
                Add / Import
              </span>
            </template>
            <a-menu-item-group v-if="isUIAllowed('addTable')" title="">
              <a-menu-item key="add-new-table" @click="tableCreateDialog = true">
                <span>
                  <MdiTableIcon class="text-primary mdi-icons" />
                  <!-- Add new table -->
                  {{ $t('tooltip.addTable') }}
                </span>
              </a-menu-item>
            </a-menu-item-group>
            <a-menu-item-group title="QUICK IMPORT FROM">
              <a-menu-item v-if="isUIAllowed('airtableImport')" key="quick-import-airtable">
                <span>
                  <MdiAirTableIcon class="text-primary mdi-icons" />
                  <!-- TODO: i18n -->
                  Airtable
                </span>
              </a-menu-item>
              <a-menu-item v-if="isUIAllowed('csvImport')" key="quick-import-csv">
                <span>
                  <MdiCsvIcon class="text-primary mdi-icons" />
                  <!-- TODO: i18n -->
                  CSV file
                </span>
              </a-menu-item>
              <a-menu-item v-if="isUIAllowed('jsonImport')" key="quick-import-json">
                <span>
                  <MdiJSONIcon class="text-primary mdi-icons" />
                  <!-- TODO: i18n -->
                  JSON file
                </span>
              </a-menu-item>
              <a-menu-item v-if="isUIAllowed('excelImport')" key="quick-import-excel">
                <span>
                  <MdiExcelIcon class="text-primary mdi-icons" />
                  <!-- TODO: i18n -->
                  Microsoft Excel
                </span>
              </a-menu-item>
            </a-menu-item-group>
            <a-divider style="margin: 0px" />
            <a-menu-item key="add-new-table" @click="tableCreateDialog = true">
              <span>
                <MdiRequestDataSourceIcon class="text-primary mdi-icons" />
                <!-- TODO: i18n -->
                Request Data Source
              </span>
            </a-menu-item>
          </a-sub-menu>
        </a-menu>
      </template>
      <DlgTableCreate v-if="tableCreateDialog" v-model="tableCreateDialog" />
    </a-tabs>

    <v-window v-model="activeTab">
      <v-window-item v-for="(tab, i) in tabs" :key="i" :value="i">
        <TabsAuth v-if="tab.type === 'auth'" :tab-meta="tab" />
        <TabsSmartsheet v-else :tab-meta="tab" />
      </v-window-item>
    </v-window>
  </div>
</template>

<style scoped lang="scss">
.mdi-icons {
  margin-bottom: -5px;
}

:deep(.ant-menu-item-group-list) .ant-menu-item {
  padding: 0px 46px 0px 16px;
  margin: 0px;
}
</style>
