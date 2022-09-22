<script setup lang="ts">
import type { ColumnType, TableType } from 'nocodb-sdk'
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import { srcDestMappingColumns, tableColumns } from './utils'
import {
  Empty,
  Form,
  MetaInj,
  ReloadViewDataHookInj,
  computed,
  createEventHook,
  extractSdkResponseErrorMsg,
  fieldRequiredValidator,
  getUIDTIcon,
  inject,
  message,
  nextTick,
  onMounted,
  reactive,
  ref,
  useI18n,
  useNuxtApp,
  useProject,
  useTabs,
  useTemplateRefsList,
} from '#imports'
import { TabType } from '~/lib'

const { quickImportType, projectTemplate, importData, importColumns, importOnly, maxRowsToParse } = defineProps<Props>()

const emit = defineEmits(['import'])

const { t } = useI18n()

interface Props {
  quickImportType: 'csv' | 'excel' | 'json'
  projectTemplate: Record<string, any>
  importData: Record<string, any>
  importColumns: any[]
  importOnly: boolean
  maxRowsToParse: number
}

interface Option {
  label: string
  value: string
}

const meta = inject(MetaInj, ref())

const columns = computed(() => meta.value?.columns || [])

const reloadHook = inject(ReloadViewDataHookInj, createEventHook())

const useForm = Form.useForm

const { $api } = useNuxtApp()

const { addTab } = useTabs()

const { sqlUi, project, loadTables } = useProject()

const hasSelectColumn = ref<boolean[]>([])

const expansionPanel = ref<number[]>([])

const editableTn = ref<boolean[]>([])

const inputRefs = useTemplateRefsList<HTMLInputElement>()

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

const srcDestMapping = ref<Record<string, any>[]>([])

const data = reactive<{ title: string | null; name: string; tables: (TableType & { ref_table_name: string })[] }>({
  title: null,
  name: 'Project Name',
  tables: [],
})

const validators = computed(() =>
  data.tables.reduce<Record<string, [ReturnType<typeof fieldRequiredValidator>]>>((acc, table, tableIdx) => {
    acc[`tables.${tableIdx}.ref_table_name`] = [fieldRequiredValidator()]
    hasSelectColumn.value[tableIdx] = false

    table.columns?.forEach((column, columnIdx) => {
      acc[`tables.${tableIdx}.columns.${columnIdx}.column_name`] = [fieldRequiredValidator()]
      acc[`tables.${tableIdx}.columns.${columnIdx}.uidt`] = [fieldRequiredValidator()]
      if (isSelect(column)) {
        hasSelectColumn.value[tableIdx] = true
      }
    })

    return acc
  }, {}),
)

const { validate, validateInfos } = useForm(data, validators)

const isValid = computed(() => {
  if (importOnly) {
    for (const record of srcDestMapping.value) {
      if (!fieldsValidation(record)) {
        return false
      }
    }
  } else {
    for (const [_, o] of Object.entries(validateInfos)) {
      if (o?.validateStatus) {
        if (o.validateStatus === 'error') {
          return false
        }
      }
    }
  }
  return true
})

const prevEditableTn = ref<string[]>([])

onMounted(() => {
  parseAndLoadTemplate()

  // used to record the previous EditableTn values
  // for checking the table duplication in current import
  // and updating the key in importData
  prevEditableTn.value = data.tables.map((t) => t.ref_table_name)

  nextTick(() => {
    inputRefs.value[0]?.focus()
  })
})

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

function missingRequiredColumnsValidation() {
  const missingRequiredColumns = columns.value.filter(
    (c: Record<string, any>) =>
      (c.pk ? !c.ai && !c.cdf : !c.cdf && c.rqd) && !srcDestMapping.value.some((r) => r.destCn === c.title),
  )

  if (missingRequiredColumns.length) {
    message.error(`${t('msg.error.columnsRequired')} : ${missingRequiredColumns.map((c) => c.title).join(', ')}`)
    return false
  }

  return true
}

function atLeastOneEnabledValidation() {
  if (srcDestMapping.value.filter((v) => v.enabled === true).length === 0) {
    message.error(t('msg.error.selectAtleastOneColumn'))
    return false
  }

  return true
}

function fieldsValidation(record: Record<string, any>) {
  // if it is not selected, then pass validation
  if (!record.enabled) {
    return true
  }

  const tableName = meta.value?.title || ''

  if (!record.destCn) {
    message.error(`${t('msg.error.columnDescriptionNotFound')} ${record.srcCn}`)
    return false
  }

  if (srcDestMapping.value.filter((v) => v.destCn === record.destCn).length > 1) {
    message.error(t('msg.error.duplicateMappingFound'))
    return false
  }

  const v = columns.value.find((c) => c.title === record.destCn) as Record<string, any>

  // check if the input contains null value for a required column
  if (v.pk ? !v.ai && !v.cdf : !v.cdf && v.rqd) {
    if (
      importData[tableName]
        .slice(0, maxRowsToParse)
        .some((r: Record<string, any>) => r[record.srcCn] === null || r[record.srcCn] === undefined || r[record.srcCn] === '')
    ) {
      message.error(t('msg.error.nullValueViolatesNotNull'))
    }
  }

  switch (v.uidt) {
    case UITypes.Number:
      if (
        importData[tableName]
          .slice(0, maxRowsToParse)
          .some(
            (r: Record<string, any>) => r[record.sourceCn] !== null && r[record.srcCn] !== undefined && isNaN(+r[record.srcCn]),
          )
      ) {
        message.error(t('msg.error.sourceHasInvalidNumbers'))
        return false
      }

      break
    case UITypes.Checkbox:
      if (
        importData[tableName].slice(0, maxRowsToParse).some((r: Record<string, any>) => {
          if (r[record.srcCn] !== null && r[record.srcCn] !== undefined) {
            let input = r[record.srcCn]
            if (typeof input === 'string') {
              input = input.replace(/["']/g, '').toLowerCase().trim()
              return !(
                input === 'false' ||
                input === 'no' ||
                input === 'n' ||
                input === '0' ||
                input === 'true' ||
                input === 'yes' ||
                input === 'y' ||
                input === '1'
              )
            }

            return input !== 1 && input !== 0 && input !== true && input !== false
          }

          return false
        })
      ) {
        message.error(t('msg.error.sourceHasInvalidBoolean'))

        return false
      }
      break
  }

  return true
}

async function importTemplate() {
  if (importOnly) {
    // validate required columns
    if (!missingRequiredColumnsValidation()) return

    // validate at least one column needs to be selected
    if (!atLeastOneEnabledValidation()) return

    try {
      isImporting.value = true

      const tableName = meta.value?.title

      // only one file is allowed currently
      const data = importData[Object.keys(importData)[0]]

      const projectName = project.value.title!

      const total = data.length

      for (let i = 0, progress = 0; i < total; i += maxRowsToParse) {
        const batchData = data.slice(i, i + maxRowsToParse).map((row: Record<string, any>) =>
          srcDestMapping.value.reduce((res: Record<string, any>, col: Record<string, any>) => {
            if (col.enabled && col.destCn) {
              const v = columns.value.find((c: Record<string, any>) => c.title === col.destCn) as Record<string, any>

              let input = row[col.srcCn]

              // parse potential boolean values
              if (v.uidt === UITypes.Checkbox) {
                input = input.replace(/["']/g, '').toLowerCase().trim()

                if (input === 'false' || input === 'no' || input === 'n') {
                  input = '0'
                } else if (input === 'true' || input === 'yes' || input === 'y') {
                  input = '1'
                }
              } else if (v.uidt === UITypes.Number) {
                if (input === '') {
                  input = null
                }
              } else if (v.uidt === UITypes.SingleSelect || v.uidt === UITypes.MultiSelect) {
                if (input === '') {
                  input = null
                }
              }
              res[col.destCn] = input
            }
            return res
          }, {}),
        )

        await $api.dbTableRow.bulkCreate('noco', projectName, tableName!, batchData)

        importingTip.value = `Importing data to ${projectName}: ${progress}/${total} records`

        progress += batchData.length
      }

      // reload table
      reloadHook.trigger()

      // Successfully imported table data
      message.success(t('msg.success.tableDataImported'))
    } catch (e: any) {
      message.error(e.message)
    } finally {
      isImporting.value = false
    }
  } else {
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
          table_name: table.ref_table_name,
          // leave title empty to get a generated one based on ref_table_name
          title: '',
          columns: table.columns || [],
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
        const offset = maxRowsToParse
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
        type: TabType.TABLE,
      })
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isImporting.value = false
    }
  }
}

function mapDefaultColumns() {
  srcDestMapping.value = []
  for (const col of importColumns[0]) {
    const o = { srcCn: col.column_name, destCn: '', enabled: true }
    if (columns.value) {
      const tableColumn = columns.value.find((c: Record<string, any>) => c.title === col.column_name)
      if (tableColumn) {
        o.destCn = tableColumn.title as string
      } else {
        o.enabled = false
      }
    }
    srcDestMapping.value.push(o)
  }
}

defineExpose({
  importTemplate,
  isValid,
})

onMounted(() => {
  if (importOnly) {
    mapDefaultColumns()
  }
})

function handleEditableTnChange(idx: number) {
  const oldValue = prevEditableTn.value[idx]
  const newValue = data.tables[idx].ref_table_name
  if (data.tables.filter((t) => t.ref_table_name === newValue).length > 1) {
    message.warn('Duplicate Table Name')
    data.tables[idx].ref_table_name = oldValue
  } else {
    prevEditableTn.value[idx] = newValue
    if (oldValue !== newValue) {
      // update the key name of importData
      delete Object.assign(importData, { [newValue]: importData[oldValue] })[oldValue]
    }
  }
  setEditableTn(idx, false)
}
</script>

<template>
  <a-spin :spinning="isImporting" :tip="importingTip" size="large">
    <a-card v-if="importOnly">
      <a-form :model="data" name="import-only">
        <p v-if="data.tables && quickImportType === 'excel'" class="text-center">
          {{ data.tables.length }} sheet{{ data.tables.length > 1 ? 's' : '' }}
          available for import
        </p>
      </a-form>

      <a-collapse v-if="data.tables && data.tables.length" v-model:activeKey="expansionPanel" class="template-collapse" accordion>
        <a-collapse-panel v-for="(table, tableIdx) of data.tables" :key="tableIdx">
          <template #header>
            <span class="font-weight-bold text-lg flex items-center gap-2">
              <mdi-table class="text-primary" />

              {{ table.ref_table_name }}
            </span>
          </template>

          <a-table
            v-if="srcDestMapping"
            class="template-form"
            row-class-name="template-form-row"
            :data-source="srcDestMapping"
            :columns="srcDestMappingColumns"
            :pagination="false"
          >
            <template #emptyText>
              <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" />
            </template>
            <template #headerCell="{ column }">
              <span v-if="column.key === 'source_column' || column.key === 'destination_column'">
                {{ column.name }}
              </span>
            </template>

            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'source_column'">
                <span>{{ record.srcCn }}</span>
              </template>

              <template v-else-if="column.key === 'destination_column'">
                <a-select
                  v-model:value="record.destCn"
                  class="w-52"
                  show-search
                  :filter-option="filterOption"
                  dropdown-class-name="nc-dropdown-filter-field"
                >
                  <a-select-option v-for="(col, i) of columns" :key="i" :value="col.title">
                    <div class="flex items-center">
                      <component :is="getUIDTIcon(col.uidt)" />
                      <span class="ml-2">{{ col.title }}</span>
                    </div>
                  </a-select-option>
                </a-select>
              </template>

              <template v-if="column.key === 'action'">
                <a-checkbox v-model:checked="record.enabled" />
              </template>
            </template>
          </a-table>
        </a-collapse-panel>
      </a-collapse>
    </a-card>

    <a-card v-else>
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
          <a-collapse-panel v-for="(table, tableIdx) of data.tables" :key="tableIdx">
            <template #header>
              <a-form-item v-if="editableTn[tableIdx]" v-bind="validateInfos[`tables.${tableIdx}.ref_table_name`]" no-style>
                <a-input
                  v-model:value="table.ref_table_name"
                  class="max-w-xs"
                  size="large"
                  hide-details
                  @click="$event.stopPropagation()"
                  @blur="handleEditableTnChange(tableIdx)"
                  @keydown.enter="handleEditableTnChange(tableIdx)"
                />
              </a-form-item>

              <span v-else class="font-weight-bold text-lg flex items-center gap-2" @click="setEditableTn(tableIdx, true)">
                <mdi-table class="text-primary" />
                {{ table.ref_table_name }}
              </span>
            </template>

            <template #extra>
              <a-tooltip bottom>
                <template #title>
                  <!-- TODO: i18n -->
                  <span>Delete Table</span>
                </template>
                <mdi-delete-outline v-if="data.tables.length > 1" class="text-lg mr-8" @click.stop="deleteTable(tableIdx)" />
              </a-tooltip>
            </template>

            <a-table
              v-if="table.columns && table.columns.length"
              class="template-form"
              row-class-name="template-form-row"
              :data-source="table.columns"
              :columns="tableColumns"
              :pagination="false"
            >
              <template #emptyText>
                <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" />
              </template>
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
                    <a-input :ref="inputRefs.set" v-model:value="record.column_name" />
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
                      dropdown-class-name="nc-dropdown-template-uidt"
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
                      <mdi-key-star class="text-lg" />
                    </div>
                  </a-tooltip>

                  <a-tooltip v-else>
                    <template #title>
                      <!-- TODO: i18n -->
                      <span>Delete Column</span>
                    </template>

                    <a-button type="text" @click="deleteTableColumn(tableIdx, record.key)">
                      <div class="flex items-center">
                        <mdi-delete-outline class="text-lg" />
                      </div>
                    </a-button>
                  </a-tooltip>
                </template>
              </template>
            </a-table>

            <div class="mt-5 flex gap-2 justify-center">
              <a-tooltip bottom>
                <template #title>
                  <!-- TODO: i18n -->
                  <span>Add Number Column</span>
                </template>

                <a-button class="group" @click="addNewColumnRow(table, 'Number')">
                  <div class="flex items-center">
                    <mdi-numeric class="group-hover:!text-accent flex text-lg" />
                  </div>
                </a-button>
              </a-tooltip>

              <a-tooltip bottom>
                <template #title>
                  <!-- TODO: i18n -->
                  <span>Add SingleLineText Column</span>
                </template>

                <a-button class="group" @click="addNewColumnRow(table, 'SingleLineText')">
                  <div class="flex items-center">
                    <mdi-alpha-a class="group-hover:!text-accent text-lg" />
                  </div>
                </a-button>
              </a-tooltip>

              <a-tooltip bottom>
                <template #title>
                  <!-- TODO: i18n -->
                  <span>Add LongText Column</span>
                </template>

                <a-button class="group" @click="addNewColumnRow(table, 'LongText')">
                  <div class="flex items-center">
                    <mdi-text class="group-hover:!text-accent text-lg" />
                  </div>
                </a-button>
              </a-tooltip>

              <a-tooltip bottom>
                <template #title>
                  <!-- TODO: i18n -->
                  <span>Add Other Column</span>
                </template>

                <a-button class="group" @click="addNewColumnRow(table, 'SingleLineText')">
                  <div class="flex items-center gap-1">
                    <mdi-plus class="group-hover:!text-accent text-lg" />
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
    @apply p-0 mb-0;
    .ant-form-item {
      @apply mb-0;
    }
  }
}
</style>
