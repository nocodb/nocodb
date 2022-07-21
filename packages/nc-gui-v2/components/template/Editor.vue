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
const hasSelectColumn = ref(<boolean[]>{})
const expansionPanel = ref(<number[]>[])
const editableTn = ref(<boolean[]>{})
const inputRefs = ref(<HTMLInputElement[]>[])
const { addTab } = useTabs()
const { sqlUi, project, loadTables } = useProject()
const loading = ref(false)
const toast = useToast()
const buttonSize = ref<SizeType>('large')
const templateForm = reactive<{ tables: object[] }>({
  tables: [],
})

const uiTypeOptions = ref<Option[]>(
  (Object.keys(UITypes) as Array<keyof typeof UITypes>)
    .filter(
      (x: any) =>
        !isVirtualCol(x) &&
        ![UITypes.ForeignKey, UITypes.ID, UITypes.CreateTime, UITypes.LastModifiedTime, UITypes.Barcode, UITypes.Button].includes(
          x,
        ),
    )
    .map((x: string) => ({
      value: x,
      label: x,
    })),
)

const filterOption = (input: string, option: Option) => {
  return option.value.toUpperCase().indexOf(input.toUpperCase()) >= 0
}

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

const data = reactive(<any>{
  name: 'Project Name',
  tables: [],
})

const validators = computed(() => {
  // TODO: centralise
  const tnValidator = [{ required: true, message: 'Please fill in table name', trigger: 'change' }]
  const cnValidator = [{ required: true, message: 'Please fill in column name', trigger: 'change' }]
  const uidtValidator = [{ required: true, message: 'Please fill in column type', trigger: 'change' }]
  // TODO: check existing validation logic
  const dtxpValidator = [{}]
  let res: any = {}
  for (let i = 0; i < data.tables.length; i++) {
    res[`tables.${i}.table_name`] = tnValidator
    hasSelectColumn.value[i] = false
    for (let j = 0; j < data.tables[i].columns.length; j++) {
      res[`tables.${i}.columns.${j}.column_name`] = cnValidator
      res[`tables.${i}.columns.${j}.uidt`] = uidtValidator
      if (isSelect(data.tables[i].columns[j])) {
        hasSelectColumn.value[i] = true
        res[`tables.${i}.columns.${j}.dtxp`] = dtxpValidator
      }
    }
  }
  return res
})

const { resetFields, validate, validateInfos } = useForm(data, validators)

const editorTitle = computed(() => {
  return `${quickImportType.toUpperCase()} Import: ${data.title}`
})

onMounted(() => {
  parseAndLoadTemplate()
})

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
        ...v.map((v: any) => {
          const res: any = {
            column_name: v.title,
            ref_table_name: {
              ...v,
            },
          }
          return res
        }),
      ],
    })),
  }
  Object.assign(data, parsedTemplate)
}

const deleteTable = (tableIdx: number) => {
  const deleteTable = data.tables[tableIdx]
  for (const table of data.tables) {
    if (table === deleteTable) {
      continue
    }
    table.columns = table.columns.filter((c: Record<string, any>) => c.ref_table_name !== deleteTable.table_name)
  }
  data.tables.splice(tableIdx, 1)
}

const isSelect = (col: ColumnType) => {
  return col.uidt === 'MultiSelect' || col.uidt === 'SingleSelect'
}

const deleteTableColumn = (i: number, j: number, col: Record<string, any>, table: Record<string, any>) => {
  const deleteTable = data.tables[i]
  const deleteColumn = deleteTable.columns[j]
  for (const table of data.tables) {
    if (table === deleteTable) {
      continue
    }
    table.columns = table.columns.filter(
      (c: Record<string, any>) => c.ref_table_name !== deleteTable.table_name || c.ref_column_name !== deleteColumn.column_name,
    )
  }
  deleteTable.columns.splice(j, 1)
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

const setEditableTn = (idx: number, val: boolean) => {
  editableTn.value[idx] = val
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
    loading.value = false
    return
  }

  try {
    loading.value = true
    // tab info to be used to show the tab after successful import
    const tab = {
      id: '',
      title: '',
    }

    // create tables
    for (const t of data.tables) {
      // enrich system fields if not provided
      // e.g. id, created_at, updated_at
      const systemColumns = sqlUi?.value.getNewTableColumns().filter((c: ColumnType) => c.column_name !== 'title')
      for (const systemColumn of systemColumns) {
        if (!t.columns.some((c: Record<string, any>) => c.column_name.toLowerCase() === systemColumn.column_name.toLowerCase())) {
          t.columns.push(systemColumn)
        }
      }

      // set pk & rqd if ID is provided
      for (const column of t.columns) {
        if (column.column_name.toLowerCase() === 'id' && !('pk' in column)) {
          column.pk = true
          column.rqd = true
          break
        }
      }
      const table = await $api.dbTable.create(project?.value?.id as string, {
        table_name: t.table_name,
        // leave title empty to get a generated one based on table_name
        title: '',
        columns: t.columns,
      })
      t.table_title = table.title

      // open the first table after import
      if (tab.id === '' && tab.title === '') {
        tab.id = table.id as string
        tab.title = table.title as string
      }

      // set primary value
      if (table?.columns[0]?.id) {
        await $api.dbTableColumn.primaryColumnSet(table.columns[0].id as string)
      }
    }
    // bulk imsert data
    if (importData) {
      let total = 0
      let progress = 0
      const projectName = project.value.title as string
      await Promise.all(
        data.tables.map((v: Record<string, any>) =>
          (async (tableMeta) => {
            const tableName = tableMeta.table_title
            const data = importData[tableMeta.ref_table_name]
            if (data) {
              total += data.length
              for (let i = 0; i < data.length; i += 500) {
                const batchData = remapColNames(data.slice(i, i + 500), tableMeta.columns)
                await $api.dbTableRow.bulkCreate('noco', projectName, tableName, batchData)
                progress += batchData.length
              }
            }
          })(v),
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
    loading.value = false
  }
}
</script>

<template>
  <a-card :title="editorTitle">
    <template #extra>
      <a-button type="primary" :loading="loading" @click="importTemplate" :size="buttonSize">
        {{ $t('activity.import') }}
      </a-button>
    </template>
    <a-form :model="data" name="template-editor-form">
      <p v-if="data.tables && quickImportType === 'excel'" class="text-center">
        {{ data.tables.length }} sheet{{ data.tables.length > 1 ? 's' : '' }}
        available for import
      </p>
      <a-collapse v-if="data.tables && data.tables.length" v-model:activeKey="expansionPanel" accordion>
        <a-collapse-panel v-for="(table, i) in data.tables" :key="i">
          <template #header>
            <a-form-item v-if="editableTn[i]" v-bind="validateInfos[`tables.${i}.table_name`]" noStyle>
              <a-input
                v-model:value="table.table_name"
                style="max-width: 300px"
                hide-details
                @click="(e) => e.stopPropagation()"
                @blur="setEditableTn(i, false)"
                @keydown.enter="setEditableTn(i, false)"
              />
            </a-form-item>
            <span v-else class="font-weight-bold text-lg" @click="(e) => (e.stopPropagation(), setEditableTn(i, true))">
              <MdiTableIcon style="margin-bottom: -5px" />
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
                style="margin-right: 30px"
                @click.stop="deleteTable(i)"
              />
            </a-tooltip>
          </template>

          <a-table
            v-if="table.columns.length"
            class="template-form"
            size="middle"
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
              <template v-else-if="column.key === 'dtxp' && hasSelectColumn[i]">
                <span>
                  <!-- TODO: i18n -->
                  Options
                </span>
              </template>
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'column_name'">
                <a-form-item v-bind="validateInfos[`tables.${i}.columns.${record.key}.${column.key}`]">
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
                <a-form-item v-bind="validateInfos[`tables.${i}.columns.${record.key}.${column.key}`]">
                  <a-auto-complete
                    v-model:value="record.uidt"
                    :options="uiTypeOptions"
                    :filter-option="filterOption"
                    style="width: 200px"
                  />
                </a-form-item>
              </template>

              <template v-else-if="column.key === 'dtxp'">
                <a-form-item v-if="isSelect(record)" v-bind="validateInfos[`tables.${i}.columns.${record.key}.${column.key}`]">
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

                  <a-button @click="deleteTableColumn(i, record.key, record, table)" type="text">
                    <div class="flex items-center">
                      <MdiDeleteOutlineIcon class="text-lg" />
                    </div>
                  </a-button>
                </a-tooltip>
              </template>
            </template>
          </a-table>
          <a-divider />
          <div class="text-center">
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
</template>

<style scoped>
.template-form :deep(.template-form-row) > td {
  padding-bottom: 0px !important;
}
</style>
