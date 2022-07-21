<script setup lang="ts">
import { useToast } from 'vue-toastification'
import type { ColumnType, TableType } from 'nocodb-sdk'
import { isVirtualCol, UITypes } from 'nocodb-sdk'
import { Form } from 'ant-design-vue'
import type { SizeType } from 'ant-design-vue/es/config-provider'
import { computed, onMounted } from '#imports'
import MdiTableIcon from '~icons/mdi/table'
import MdiStringIcon from '~icons/mdi/alpha-a'
import MdiLongTextIcon from '~icons/mdi/text'
import MdiNumericIcon from '~icons/mdi/numeric'
import MdiPlusIcon from '~icons/mdi/plus'
import MdiKeyStarIcon from '~icons/mdi/key-star'
import MdiDeleteOutlineIcon from '~icons/mdi/delete-outline'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'

interface Props {
  quickImportType: 'csv' | 'excel' | 'json'
  projectTemplate: object
  importData: any[]
}

interface Option {
  value: string
}

const useForm = Form.useForm
const { quickImportType, projectTemplate, importData } = defineProps<Props>()
const { $api } = useNuxtApp()
const tableColumns = [
  {
    name: 'Column Name',
    dataIndex: 'column_name',
    key: 'column_name',
    width: 250,
  },
  {
    name: 'Column Type',
    dataIndex: 'column_type',
    key: 'uidt',
    width: 250,
  },
  {
    name: 'Select Option',
    key: 'dtxp',
  },
  {
    name: 'Action',
    key: 'action',
    align: 'right',
  },
]
const templateForm = reactive<{ tables: object[] }>({
  tables: [],
})
const buttonSize = ref<SizeType>('large')
const hasSelectColumn = ref(<boolean[]>{})
const expansionPanel = ref(<number[]>[])
const editableTn = ref(<boolean[]>{})
const inputRefs = ref(<HTMLInputElement[]>[])
const isImporting = ref(false)
const importingTip = ref('Importing')
const uiTypeOptions = ref<Option[]>(
  (Object.keys(UITypes) as Array<keyof typeof UITypes>)
    .filter(
      (uiType: any) =>
        !isVirtualCol(uiType) &&
        ![UITypes.ForeignKey, UITypes.ID, UITypes.CreateTime, UITypes.LastModifiedTime, UITypes.Barcode, UITypes.Button].includes(
          uiType,
        ),
    )
    .map((uiType: string) => ({
      value: uiType,
      label: uiType,
    })),
)
const data = reactive(<any>{
  name: 'Project Name',
  tables: [],
})

const toast = useToast()
const { addTab } = useTabs()
const { sqlUi, project, loadTables } = useProject()

onMounted(() => {
  parseAndLoadTemplate()
})

const validators = computed(() => {
  // TODO: centralise
  const tnValidator = [{ required: true, message: 'Please fill in table name', trigger: 'change' }]
  const cnValidator = [{ required: true, message: 'Please fill in column name', trigger: 'change' }]
  const uidtValidator = [{ required: true, message: 'Please fill in column type', trigger: 'change' }]
  let res: any = {}
  for (let tableIdx = 0; tableIdx < data.tables.length; tableIdx++) {
    res[`tables.${tableIdx}.table_name`] = tnValidator
    hasSelectColumn.value[tableIdx] = false
    for (let columnIdx = 0; columnIdx < data.tables[tableIdx].columns.length; columnIdx++) {
      res[`tables.${tableIdx}.columns.${columnIdx}.column_name`] = cnValidator
      res[`tables.${tableIdx}.columns.${columnIdx}.uidt`] = uidtValidator
      if (isSelect(data.tables[tableIdx].columns[columnIdx])) {
        hasSelectColumn.value[tableIdx] = true
      }
    }
  }
  return res
})

const editorTitle = computed(() => {
  return `${quickImportType.toUpperCase()} Import: ${data.title}`
})

const { resetFields, validate, validateInfos } = useForm(data, validators)

const filterOption = (input: string, option: Option) => {
  return option.value.toUpperCase().indexOf(input.toUpperCase()) >= 0
}

const parseAndLoadTemplate = () => {
  if (projectTemplate) {
    parseTemplate(projectTemplate)
    expansionPanel.value = Array.from({ length: data.tables.length || 0 }, (_, i) => i)
    hasSelectColumn.value = Array.from({ length: data.tables.length || 0 }, () => false)
  }
}

const parseTemplate = ({ tables = [], ...rest }: Record<string, any>) => {
  const parsedTemplate = {
    ...rest,
    tables: tables.map(({ v = [], columns = [], ...rest }: Record<string, any>) => ({
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

const isSelect = (col: ColumnType) => {
  return col.uidt === 'MultiSelect' || col.uidt === 'SingleSelect'
}

const deleteTable = (tableIdx: number) => {
  data.tables.splice(tableIdx, 1)
}

const deleteTableColumn = (tableIdx: number, columnIdx: number) => {
  data.tables[tableIdx].columns = data.tables[tableIdx].columns.filter((c: any) => c.key !== columnIdx)
}

const addNewColumnRow = (table: Record<string, any>, uidt?: string) => {
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

const setEditableTn = (tableIdx: number, val: boolean) => {
  editableTn.value[tableIdx] = val
}

const remapColNames = (batchData: any[], columns: ColumnType[]) => {
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

const importTemplate = async () => {
  // check if form is valid
  try {
    await validate()
  } catch (errorInfo) {
    toast.error('Please fill all the required values')
    isImporting.value = false
    return
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
        if (
          !table.columns.some((c: Record<string, any>) => c.column_name.toLowerCase() === systemColumn.column_name.toLowerCase())
        ) {
          table.columns.push(systemColumn)
        }
      }

      // set pk & rqd if ID is provided
      for (const column of table.columns) {
        if (column.column_name.toLowerCase() === 'id' && !('pk' in column)) {
          column.pk = true
          column.rqd = true
          break
        }
      }
      const tableMeta = await $api.dbTable.create(project?.value?.id as string, {
        table_name: table.table_name,
        // leave title empty to get a generated one based on table_name
        title: '',
        columns: table.columns,
      })
      table.table_title = tableMeta.title

      // open the first table after import
      if (tab.id === '' && tab.title === '') {
        tab.id = tableMeta.id as string
        tab.title = tableMeta.title as string
      }

      // set primary value
      if (tableMeta?.columns[0]?.id) {
        await $api.dbTableColumn.primaryColumnSet(tableMeta.columns[0].id as string)
      }
    }
    // bulk imsert data
    if (importData) {
      let total = 0
      let progress = 0
      let offset = 500
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
                await $api.dbTableRow.bulkCreate('noco', projectName, tableMeta.table_title, batchData)
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
    // TODO: close dialog when the integration is ready
    isImporting.value = false
  }
}
</script>

<template>
  <a-spin :spinning="isImporting" :tip="importingTip" size="large">
    <a-card :title="editorTitle">
      <template #extra>
        <a-button type="primary" @click="importTemplate" :size="buttonSize">
          {{ $t('activity.import') }}
        </a-button>
      </template>
      <a-form :model="data" name="template-editor-form">
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
              <a-form-item v-if="editableTn[tableIdx]" v-bind="validateInfos[`tables.${tableIdx}.table_name`]" noStyle>
                <a-input
                  v-model:value="table.table_name"
                  style="max-width: 300px"
                  hide-details
                  @click="(e) => e.stopPropagation()"
                  @blur="setEditableTn(tableIdx, false)"
                  @keydown.enter="setEditableTn(tableIdx, false)"
                />
              </a-form-item>
              <span v-else class="font-weight-bold text-lg" @click="(e) => (e.stopPropagation(), setEditableTn(tableIdx, true))">
                <MdiTableIcon class="text-primary" style="margin-bottom: -5px" />
                {{ table.table_name }}
              </span>
            </template>
            <template #extra>
              <a-tooltip bottom>
                <template #title>
                  <!-- TODO: i18n -->
                  <span>Delete Table</span>
                </template>
                <MdiDeleteOutlineIcon
                  v-if="data.tables.length > 1"
                  class="text-lg"
                  style="margin-right: 25px"
                  @click.stop="deleteTable(tableIdx)"
                />
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
                      v-model:value="record.column_name"
                      :ref="
                        (el) => {
                          inputRefs[record.key] = el
                        }
                      "
                    />
                  </a-form-item>
                </template>
                <template v-else-if="column.key === 'uidt'">
                  <a-form-item v-bind="validateInfos[`tables.${tableIdx}.columns.${record.key}.${column.key}`]">
                    <a-auto-complete
                      v-model:value="record.uidt"
                      :options="uiTypeOptions"
                      :filter-option="filterOption"
                      style="width: 200px"
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
                    <span style="margin-right: 15px">
                      <MdiKeyStarIcon class="text-lg" />
                    </span>
                  </a-tooltip>
                  <a-tooltip v-else>
                    <template #title>
                      <!-- TODO: i18n -->
                      <span>Delete Column</span>
                    </template>

                    <a-button @click="deleteTableColumn(tableIdx, record.key)" type="text">
                      <div class="flex items-center">
                        <MdiDeleteOutlineIcon class="text-lg" />
                      </div>
                    </a-button>
                  </a-tooltip>
                </template>
              </template>
            </a-table>
            <div class="text-center" style="margin-top: 15px">
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
                <a-button @click="addNewColumnRow(table)">
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
  background-color: #ffffff;
}

.template-form {
  :deep(.ant-table-thead) > tr > th {
    background: #ffffff;
  }
  :deep(.template-form-row) > td {
    padding-bottom: 0px !important;
  }
}
</style>
