<script setup lang="ts">
import { useToast } from 'vue-toastification'
import type { ColumnType, TableType } from 'nocodb-sdk'
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import { Form } from 'ant-design-vue'
import { tableColumns } from './utils'
import { computed, onMounted } from '#imports'
import MdiTableIcon from '~icons/mdi/table'
import MdiStringIcon from '~icons/mdi/alpha-a'
import MdiLongTextIcon from '~icons/mdi/text'
import MdiNumericIcon from '~icons/mdi/numeric'
import MdiPlusIcon from '~icons/mdi/plus'
import MdiKeyStarIcon from '~icons/mdi/key-star'
import MdiDeleteOutlineIcon from '~icons/mdi/delete-outline'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import { fieldRequiredValidator } from '~/utils/validation'

interface Props {
  quickImportType: 'csv' | 'excel' | 'json'
  projectTemplate: Record<string, any>
  importData: any[]
}

interface Option {
  label: string
  value: string
}

const { quickImportType, projectTemplate, importData } = defineProps<Props>()

const emit = defineEmits(['import'])

const useForm = Form.useForm

const { $api } = useNuxtApp()

const hasSelectColumn = ref<boolean[]>([])

const expansionPanel = ref<number[]>([])

const editableTn = ref<boolean[]>([])

const inputRefs = ref<HTMLInputElement[]>([])

const isImporting = ref(false)

const importingTip = ref('Importing')

const uiTypeOptions = ref<Option[]>(
  (Object.keys(UITypes) as (keyof typeof UITypes)[])
    .filter(
      (uiType) =>
        !isVirtualCol(UITypes[uiType]) &&
        ![UITypes.ForeignKey, UITypes.ID, UITypes.CreateTime, UITypes.LastModifiedTime, UITypes.Barcode, UITypes.Button].includes(
          UITypes[uiType],
        ),
    )
    .map<Option>((uiType) => ({
      value: uiType,
      label: uiType,
    })),
)

const data = reactive<{ title: string | null; name: string; tables: TableType[] }>({
  title: null,
  name: 'Project Name',
  tables: [],
})

const toast = useToast()

const { addTab } = useTabs()

const { sqlUi, project, loadTables } = useProject()

onMounted(() => {
  parseAndLoadTemplate()
  nextTick(() => {
    inputRefs.value[0]?.focus()
  })
})

const validators = computed(() =>
  data.tables.reduce<Record<string, [typeof fieldRequiredValidator]>>((acc, table, tableIdx) => {
    acc[`tables.${tableIdx}.table_name`] = [fieldRequiredValidator]
    hasSelectColumn.value[tableIdx] = false

    table.columns?.forEach((column, columnIdx) => {
      acc[`tables.${tableIdx}.columns.${columnIdx}.column_name`] = [fieldRequiredValidator]
      acc[`tables.${tableIdx}.columns.${columnIdx}.uidt`] = [fieldRequiredValidator]
      if (isSelect(column)) {
        hasSelectColumn.value[tableIdx] = true
      }
    })

    return acc
  }, {}),
)

const { validate, validateInfos } = useForm(data, validators)

function filterOption(input: string, option: Option) {
  return option.value.toUpperCase().includes(input.toUpperCase())
}

function parseAndLoadTemplate() {
  if (projectTemplate) {
    parseTemplate(projectTemplate)
    expansionPanel.value = Array.from({ length: data.tables.length || 0 }, (_, i) => i)
    hasSelectColumn.value = Array.from({ length: data.tables.length || 0 }, () => false)
  }
}

function parseTemplate({ tables = [], ...rest }: Props['projectTemplate']) {
  const parsedTemplate = {
    ...rest,
    tables: tables.map(({ v = [], columns = [], ...rest }) => ({
      ...rest,
      columns: [
        ...columns.map((c: any, idx: number) => {
          c.key = idx
          return c
        }),
        ...v.map((v: any) => ({
          column_name: v.title,
          ref_table_name: {
            ...v,
          },
        })),
      ],
    })),
  }
  Object.assign(data, parsedTemplate)
}

function isSelect(col: ColumnType) {
  return col.uidt === 'MultiSelect' || col.uidt === 'SingleSelect'
}

function deleteTable(tableIdx: number) {
  data.tables.splice(tableIdx, 1)
}

function deleteTableColumn(tableIdx: number, columnIdx: number) {
  data.tables[tableIdx].columns?.splice(columnIdx, 1)
}

function addNewColumnRow(table: Record<string, any>, uidt?: string) {
  table.columns.push({
    key: table.columns.length,
    column_name: `title${table.columns.length + 1}`,
    uidt,
  })
  nextTick(() => {
    const input = inputRefs.value[table.columns.length - 1]
    input.focus()
    input.select()
  })
}

function setEditableTn(tableIdx: number, val: boolean) {
  editableTn.value[tableIdx] = val
}

function remapColNames(batchData: any[], columns: ColumnType[]) {
  return batchData.map((data) =>
    (columns || []).reduce(
      (aggObj, col: Record<string, any>) => ({
        ...aggObj,
        [col.column_name]: data[col.ref_column_name || col.column_name],
      }),
      {},
    ),
  )
}

async function importTemplate() {
  // check if form is valid
  try {
    await validate()
  } catch (errorInfo) {
    isImporting.value = false
    throw new Error('Please fill all the required values')
  }

  try {
    isImporting.value = true
    // tab info to be used to show the tab after successful import
    const tab = {
      id: '',
      title: '',
    }

    // create tables
    for (const table of data.tables) {
      // enrich system fields if not provided
      // e.g. id, created_at, updated_at
      const systemColumns = sqlUi?.value.getNewTableColumns().filter((c: ColumnType) => c.column_name !== 'title')
      for (const systemColumn of systemColumns) {
        if (!table.columns?.some((c) => c.column_name?.toLowerCase() === systemColumn.column_name.toLowerCase())) {
          table.columns?.push(systemColumn)
        }
      }

      // set pk & rqd if ID is provided
      if (table.columns) {
        for (const column of table.columns) {
          if (column.column_name?.toLowerCase() === 'id' && !('pk' in column)) {
            column.pk = true
            column.rqd = true
            break
          }
        }
      }
      const tableMeta = await $api.dbTable.create(project?.value?.id as string, {
        table_name: table.table_name,
        // leave title empty to get a generated one based on table_name
        title: '',
        columns: table.columns,
      })
      table.title = tableMeta.title

      // open the first table after import
      if (tab.id === '' && tab.title === '') {
        tab.id = tableMeta.id as string
        tab.title = tableMeta.title as string
      }

      // set primary value
      if (tableMeta?.columns?.[0]?.id) {
        await $api.dbTableColumn.primaryColumnSet(tableMeta.columns[0].id as string)
      }
    }
    // bulk insert data
    if (importData) {
      let total = 0
      let progress = 0
      const offset = 500
      const projectName = project.value.title as string
      await Promise.all(
        data.tables.map((table: Record<string, any>) =>
          (async (tableMeta) => {
            const data = importData[tableMeta.ref_table_name]
            if (data) {
              total += data.length
              for (let i = 0; i < data.length; i += offset) {
                importingTip.value = `Importing data to ${projectName}: ${progress}/${total} records`
                const batchData = remapColNames(data.slice(i, i + offset), tableMeta.columns)
                await $api.dbTableRow.bulkCreate('noco', projectName, tableMeta.title, batchData)
                progress += batchData.length
              }
            }
          })(table),
        ),
      )
    }
    // reload table list
    await loadTables()
    addTab({
      ...tab,
      type: 'table',
    })
  } catch (e: any) {
    toast.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isImporting.value = false
  }
}

const isValid = computed(() => {
  for (const [_, o] of Object.entries(validateInfos)) {
    if (o?.validateStatus) {
      if (o.validateStatus === 'error') {
        return false
      }
    }
  }
  return true
})

defineExpose({
  importTemplate,
  isValid,
})
</script>

<template>
  <a-spin :spinning="isImporting" :tip="importingTip" size="large">
    <a-card>
      <a-form :model="data" name="template-editor-form" @keydown.enter="emit('import')">
        <p v-if="data.tables && quickImportType === 'excel'" class="text-center">
          {{ data.tables.length }} sheet{{ data.tables.length > 1 ? 's' : '' }}
          available for import
        </p>
        <a-collapse
          v-if="data.tables && data.tables.length"
          v-model:activeKey="expansionPanel"
          class="template-collapse"
          accordion
        >
          <a-collapse-panel v-for="(table, tableIdx) in data.tables" :key="tableIdx">
            <template #header>
              <a-form-item v-if="editableTn[tableIdx]" v-bind="validateInfos[`tables.${tableIdx}.table_name`]" no-style>
                <a-input
                  v-model:value="table.table_name"
                  class="max-w-xs"
                  size="large"
                  hide-details
                  @click="(e) => e.stopPropagation()"
                  @blur="setEditableTn(tableIdx, false)"
                  @keydown.enter="setEditableTn(tableIdx, false)"
                />
              </a-form-item>
              <span v-else class="font-weight-bold text-lg flex items-center gap-2" @click="setEditableTn(tableIdx, true)">
                <MdiTableIcon class="text-primary" />
                {{ table.table_name }}
              </span>
            </template>
            <template #extra>
              <a-tooltip bottom>
                <template #title>
                  <!-- TODO: i18n -->
                  <span>Delete Table</span>
                </template>
                <MdiDeleteOutlineIcon v-if="data.tables.length > 1" class="text-lg mr-8" @click.stop="deleteTable(tableIdx)" />
              </a-tooltip>
            </template>

            <a-table
              v-if="table.columns.length"
              class="template-form"
              row-class-name="template-form-row"
              :data-source="table.columns"
              :columns="tableColumns"
              :pagination="false"
            >
              <template #headerCell="{ column }">
                <template v-if="column.key === 'column_name'">
                  <span>
                    {{ $t('labels.columnName') }}
                  </span>
                </template>
                <template v-else-if="column.key === 'uidt'">
                  <span>
                    {{ $t('labels.columnType') }}
                  </span>
                </template>
                <template v-else-if="column.key === 'dtxp' && hasSelectColumn[tableIdx]">
                  <span>
                    <!-- TODO: i18n -->
                    Options
                  </span>
                </template>
              </template>
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'column_name'">
                  <a-form-item v-bind="validateInfos[`tables.${tableIdx}.columns.${record.key}.${column.key}`]">
                    <a-input
                      :ref="
                        (el) => {
                          inputRefs[record.key] = el
                        }
                      "
                      v-model:value="record.column_name"
                    />
                  </a-form-item>
                </template>
                <template v-else-if="column.key === 'uidt'">
                  <a-form-item v-bind="validateInfos[`tables.${tableIdx}.columns.${record.key}.${column.key}`]">
                    <a-select
                      v-model:value="record.uidt"
                      class="w-52"
                      show-search
                      :options="uiTypeOptions"
                      :filter-option="filterOption"
                    />
                  </a-form-item>
                </template>

                <template v-else-if="column.key === 'dtxp'">
                  <a-form-item v-if="isSelect(record)">
                    <a-input v-model:value="record.dtxp" />
                  </a-form-item>
                </template>

                <template v-if="column.key === 'action'">
                  <a-tooltip v-if="record.key === 0">
                    <template #title>
                      <!-- TODO: i18n -->
                      <span>Primary Value</span>
                    </template>
                    <div class="flex items-center float-right mr-4">
                      <MdiKeyStarIcon class="text-lg" />
                    </div>
                  </a-tooltip>
                  <a-tooltip v-else>
                    <template #title>
                      <!-- TODO: i18n -->
                      <span>Delete Column</span>
                    </template>

                    <a-button type="text" @click="deleteTableColumn(tableIdx, record.key)">
                      <div class="flex items-center">
                        <MdiDeleteOutlineIcon class="text-lg" />
                      </div>
                    </a-button>
                  </a-tooltip>
                </template>
              </template>
            </a-table>
            <div class="text-center mt-5">
              <a-tooltip bottom>
                <template #title>
                  <!-- TODO: i18n -->
                  <span>Add Number Column</span>
                </template>

                <a-button @click="addNewColumnRow(table, 'Number')">
                  <div class="flex items-center">
                    <MdiNumericIcon class="text-lg" />
                  </div>
                </a-button>
              </a-tooltip>

              <a-tooltip bottom>
                <template #title>
                  <!-- TODO: i18n -->
                  <span>Add SingleLineText Column</span>
                </template>
                <a-button @click="addNewColumnRow(table, 'SingleLineText')">
                  <div class="flex items-center">
                    <MdiStringIcon class="text-lg" />
                  </div>
                </a-button>
              </a-tooltip>

              <a-tooltip bottom>
                <template #title>
                  <!-- TODO: i18n -->
                  <span>Add LongText Column</span>
                </template>
                <a-button @click="addNewColumnRow(table, 'LongText')">
                  <div class="flex items-center">
                    <MdiLongTextIcon class="text-lg" />
                  </div>
                </a-button>
              </a-tooltip>

              <a-tooltip bottom>
                <template #title>
                  <!-- TODO: i18n -->
                  <span>Add Other Column</span>
                </template>
                <a-button @click="addNewColumnRow(table, 'SingleLineText')">
                  <div class="flex items-center">
                    <MdiPlusIcon class="text-lg" />
                    Column
                  </div>
                </a-button>
              </a-tooltip>
            </div>
          </a-collapse-panel>
        </a-collapse>
      </a-form>
    </a-card>
  </a-spin>
</template>

<style scoped lang="scss">
.template-collapse {
  @apply bg-white;
}

.template-form {
  :deep(.ant-table-thead) > tr > th {
    @apply bg-white;
  }
  :deep(.template-form-row) > td {
    @apply pa-0 mb-0;
    .ant-form-item {
      @apply mb-0;
    }
  }
}
</style>
