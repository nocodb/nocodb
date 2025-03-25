<script setup lang="ts">
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import type { ColumnType, OracleUi, TableType } from 'nocodb-sdk'
import {
  SqlUiFactory,
  UITypes,
  getDateFormat,
  getDateTimeFormat,
  isSystemColumn,
  isVirtualCol,
  parseStringDate,
} from 'nocodb-sdk'
import type { CheckboxChangeEvent } from 'ant-design-vue/es/checkbox/interface'
import { srcDestMappingColumns, tableColumns } from './utils'
import { NcCheckbox } from '#components'

interface Props {
  quickImportType: 'csv' | 'excel' | 'json'
  baseTemplate: Record<string, any>
  importData: Record<string, any>
  importColumns: any[]
  importDataOnly: boolean
  maxRowsToParse: number
  baseId: string
  sourceId: string
  importWorker: Worker
  tableIcon?: string
}

interface Option {
  label: string
  value: string
}

const { quickImportType, baseTemplate, importData, importColumns, importDataOnly, maxRowsToParse, baseId, sourceId } =
  defineProps<Props>()

const emit = defineEmits(['import', 'error', 'change'])

dayjs.extend(utc)

const { t } = useI18n()

const { getMeta } = useMetas()

const meta = inject(MetaInj, ref())

const filterForDestinationColumn = (col: ColumnType): boolean => {
  if ([UITypes.ForeignKey, UITypes.ID].includes(col.uidt as UITypes)) {
    return true
  } else {
    return !isSystemColumn(col) && !isVirtualCol(col) && !isAttachment(col)
  }
}

const columns = computed(() => meta.value?.columns?.filter((col) => filterForDestinationColumn(col)) || [])

const reloadHook = inject(ReloadViewDataHookInj, createEventHook())

const useForm = Form.useForm

const { $api, $state } = useNuxtApp()

const { addTab } = useTabs()

const basesStore = useBases()
const { bases } = storeToRefs(basesStore)

const { base: activeBase } = storeToRefs(useBase())

const base = computed(() => bases.value.get(baseId) || activeBase.value)

const tablesStore = useTablesStore()
const { openTable, loadProjectTables } = tablesStore
const { baseTables } = storeToRefs(tablesStore)

const sqlUis = computed(() => {
  const temp: Record<string, any> = {}

  for (const source of base.value.sources ?? []) {
    if (source.id) {
      temp[source.id] = SqlUiFactory.create({ client: source.type }) as Exclude<
        ReturnType<(typeof SqlUiFactory)['create']>,
        typeof OracleUi
      >
    }
  }

  return temp
})

const sqlUi = computed(() => sqlUis.value[sourceId] || Object.values(sqlUis.value)[0])

const hasSelectColumn = ref<boolean[]>([])

const expansionPanel = ref<number[]>([])

const autoInsertOption = ref<boolean>(false)

const inputRefs = ref<HTMLInputElement[]>([])

const isImporting = ref(false)

const importingTips = ref<Record<string, string>>({})

const importingTableTips = ref<Record<string, number>>({})

const formError = ref()

const srcDestMapping = ref<Record<string, Record<string, any>[]>>({})

const data = reactive<{
  title: string | null
  name: string
  tables: (TableType & { ref_table_name: string; columns: (ColumnType & { key: number; _disableSelect?: boolean })[] })[]
}>({
  title: null,
  name: 'Base Name',
  tables: [],
})

const validators = computed(() =>
  data.tables.reduce<Record<string, [ReturnType<typeof fieldRequiredValidator>]>>((acc: Record<string, any>, table, tableIdx) => {
    acc[`tables.${tableIdx}.table_name`] = [
      validateTableName,
      {
        validator: (_rule: any, value: any) => {
          return new Promise<void>((resolve, reject) => {
            if (!importDataOnly && data.tables.some((item, idx) => idx !== tableIdx && item.table_name === value)) {
              return reject(new Error(t('msg.error.duplicateTableName')))
            }
            resolve()
          })
        },
      },
      {
        validator: (_rule: any, value: any) => {
          return new Promise<void>((resolve, reject) => {
            if (value !== value?.trim()) {
              return reject(new Error('Table names should not have whitespace in the beginning or their end.'))
            }
            resolve()
          })
        },
      },
    ]

    acc[`tables.${tableIdx}.columns`] = [
      {
        validator: (_rule: any, value: any) => {
          return new Promise<void>((resolve, reject) => {
            if (!importDataOnly && ncIsArray(value) && !value.some((item) => item.selected)) {
              return reject(new Error(t('msg.error.selectAtleastOneColumn')))
            }

            resolve()
          })
        },
      },
    ]

    hasSelectColumn.value[tableIdx] = false

    table.columns?.forEach((column, columnIdx) => {
      acc[`tables.${tableIdx}.columns.${columnIdx}.title`] = [
        fieldRequiredValidator(),
        {
          validator: (_rule: any, value: any) => {
            return new Promise<void>((resolve, reject) => {
              const field = table.columns.find((_item, idx) => idx === columnIdx)

              if (!field || !field?.selected) return resolve()

              const fieldToCheck = table.columns.filter((item) => item.selected)
              if (
                fieldToCheck.length &&
                table.columns.some((item, idx) => idx !== columnIdx && item.selected && item.title === value)
              ) {
                return reject(new Error(t('msg.error.duplicateColumnName')))
              }
              resolve()
            })
          },
        },
        {
          validator: (rule: any, value: any) => {
            return new Promise<void>((resolve, reject) => {
              const field = table.columns.find((_item, idx) => idx === columnIdx)

              if (!field || !field?.selected) return resolve()

              return reservedFieldNameValidator()
                .validator(rule, value)
                .then(() => {
                  resolve()
                })
                .catch((e) => {
                  reject(e)
                })
            })
          },
        },
        {
          validator: (rule: any, value: any) => {
            return new Promise<void>((resolve, reject) => {
              const field = table.columns.find((_item, idx) => idx === columnIdx)

              if (!field || !field?.selected) return resolve()

              return fieldLengthValidator()
                .validator(rule, value)
                .then(() => {
                  resolve()
                })
                .catch((e) => {
                  reject(e)
                })
            })
          },
        },
      ]
      acc[`tables.${tableIdx}.columns.${columnIdx}.uidt`] = [fieldRequiredValidator()]
      if (isSelect(column)) {
        hasSelectColumn.value[tableIdx] = true
      }
    })

    return acc
  }, {}),
)

const { validate, validateInfos, modelRef } = useForm(data, validators)

const isValid = ref(!importDataOnly)

const importError = ref('')

const formRef = ref()

watch(
  [() => srcDestMapping.value],
  () => {
    let res = true
    if (importDataOnly) {
      for (const tn of Object.keys(srcDestMapping.value)) {
        let flag = false
        if (atLeastOneEnabledValidation(tn)) {
          res = false
        }
        for (const record of srcDestMapping.value[tn]) {
          if (!fieldsValidation(record, tn)) {
            res = false
            flag = true
            break
          }
        }
        if (flag) {
          break
        }
      }
    } else {
      for (const [_, o] of Object.entries(validateInfos)) {
        if (o?.validateStatus) {
          if (o.validateStatus === 'error') {
            res = false
          }
        }
      }
    }
    isValid.value = res
  },
  { deep: true },
)

onMounted(() => {
  parseAndLoadTemplate()

  if (importDataOnly) {
    mapDefaultColumns()
  }

  nextTick(() => {
    inputRefs.value[0]?.focus()
  })
})

function filterOption(input: string, option: Option) {
  return option.value.toUpperCase().includes(input.toUpperCase())
}

function parseAndLoadTemplate() {
  if (baseTemplate) {
    parseTemplate(baseTemplate)

    expansionPanel.value = Array.from({ length: data.tables.length || 0 }, (_, i) => i)

    hasSelectColumn.value = Array.from({ length: data.tables.length || 0 }, () => false)
  }
}

function parseTemplate({ tables = [], ...rest }: Props['baseTemplate']) {
  const parsedTemplate = {
    ...rest,
    tables: tables.map(({ v = [], columns = [], ...rest }) => ({
      ...rest,
      columns: [
        ...columns.map((c: any, idx: number) => {
          if (!importDataOnly && c.column_name?.toLowerCase() === 'id') {
            const cn = populateUniqueColumnName('id', [], columns)
            c.column_name = cn
          }
          c.key = idx
          c.selected = true
          return c
        }),
        ...v.map((v: any) => ({
          column_name: v.title,
          selected: true,
          table_name: {
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

function _deleteTable(tableIdx: number) {
  data.tables.splice(tableIdx, 1)
}

function remapColNames(batchData: any[], columns: ColumnType[]) {
  const dateFormatMap: Record<number, string> = {}
  return batchData.map((data) =>
    (columns || []).reduce((aggObj, col: Record<string, any>) => {
      // we renaming existing id column and using our own auto increment id
      if (col.uidt === UITypes.ID) return aggObj

      // for excel & json, if the column name is changed in TemplateEditor,
      // then only col.column_name exists in data, else col.ref_column_name
      // for csv, col.column_name always exists in data
      // since it streams the data in getData() with the updated col.column_name
      const key = col.title in data ? col.title : col.ref_column_name
      let d = data[key]
      if (col.uidt === UITypes.Date && d) {
        let dateFormat
        if (col?.meta?.date_format) {
          dateFormat = col.meta.date_format
          dateFormatMap[col.key] = dateFormat
        } else if (col.key in dateFormatMap) {
          dateFormat = dateFormatMap[col.key]
        } else {
          dateFormat = getDateFormat(d)
          dateFormatMap[col.key] = dateFormat
        }
        d = parseStringDate(d, dateFormat)
      } else if (col.uidt === UITypes.DateTime && d) {
        const dateTimeFormat = getDateTimeFormat(data[key])
        d = dayjs(data[key], dateTimeFormat).format('YYYY-MM-DD HH:mm')
      }
      return {
        ...aggObj,
        [col.title]: d,
      }
    }, {}),
  )
}

function missingRequiredColumnsValidation(tn: string, showError = false) {
  const missingRequiredColumns = columns.value.filter(
    (c: Record<string, any>) =>
      (c.pk ? !c.ai && !c.cdf && !c.meta?.ag : !c.cdf && c.rqd) &&
      !srcDestMapping.value[tn].some((r: Record<string, any>) => r.destCn === c.title),
  )

  if (missingRequiredColumns.length) {
    const error = `${t('msg.error.columnsRequired')} : ${missingRequiredColumns.map((c) => c.title).join(', ')}`
    if (showError) {
      message.error(error)
    } else {
      return error
    }

    return true
  }

  return false
}

function atLeastOneEnabledValidation(tn: string, showError = false) {
  if (srcDestMapping.value[tn].filter((v: Record<string, any>) => v.enabled === true).length === 0) {
    const err = t('msg.error.selectAtleastOneColumn')
    if (showError) {
      message.error(err)
    } else {
      return err
    }

    return true
  }
  return false
}

function getUnselectedFields(record: Record<string, any>, tn: string) {
  // if it is not selected, then pass validation
  const allRecord = srcDestMapping.value[tn]

  return columns.value.filter((c) => {
    // Exclude columns that are already mapped, except for the current record's `destCn`

    return !allRecord?.some((item) => item.srcTitle !== record.srcTitle && item.destCn === c.title)
  })
}

function fieldsValidation(record: Record<string, any>, tn: string) {
  // if it is not selected, then pass validation
  if (!record.enabled) {
    return true
  }

  if (!record.destCn) {
    message.error(`${t('msg.error.columnDescriptionNotFound')} ${record.srcTitle}`)
    return false
  }

  if (srcDestMapping.value[tn].filter((v: Record<string, any>) => v.destCn === record.destCn).length > 1) {
    message.error(t('msg.error.duplicateMappingFound'))
    return false
  }

  const v = columns.value.find((c) => c.title === record.destCn) as Record<string, any>

  for (const tableName of Object.keys(importData)) {
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
  }
  return true
}

function updateImportTips(baseName: string, tableName: string, progress: number, total: number) {
  importingTips.value[`${baseName}-${tableName}`] = `Importing data to ${baseName} - ${tableName}: ${progress}/${total} records`
  importingTableTips.value[tableName] = parseInt(`${(progress / total) * 100}`)
}

async function importTemplate() {
  if (importDataOnly) {
    for (const table of data.tables) {
      // validate required columns
      const validationErrors = getErrorByTableName(table.table_name)
      if (validationErrors.length) throw new Error(`${validationErrors[0]}`)
    }

    try {
      isImporting.value = true
      // collapse table
      expansionPanel.value = []

      const tableId = meta.value?.id
      const baseId = base.value.id!
      const table_names = data.tables.map((t: Record<string, any>) => t.table_name)

      await Promise.all(
        Object.keys(importData).map((key: string) =>
          (async (k) => {
            if (!table_names.includes(k)) {
              return
            }
            const data = importData[k]
            const total = data.length
            let operationId
            for (let i = 0, progress = 0; i < total; i += maxRowsToParse) {
              const batchData = data.slice(i, i + maxRowsToParse).map((row: Record<string, any>) =>
                srcDestMapping.value[k].reduce((res: Record<string, any>, col: Record<string, any>) => {
                  if (col.enabled && col.destCn) {
                    const v = columns.value.find((c: Record<string, any>) => c.title === col.destCn) as Record<string, any>
                    let input = row[col.srcCn]
                    // parse potential boolean values
                    if (v.uidt === UITypes.Checkbox) {
                      if (typeof input === 'string') {
                        input = input ? input.replace(/["']/g, '').toLowerCase().trim() : 'false'
                      }
                      input = input ?? 'false'
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
                    } else if (v.uidt === UITypes.Date) {
                      if (input) {
                        input = parseStringDate(input, v.meta.date_format)
                      }
                    }
                    res[col.destCn] = input
                  }
                  return res
                }, {}),
              )
              const res = await $api.dbTableRow.bulkCreate(
                'noco',
                baseId,
                tableId,
                batchData,
                {
                  'wrapped': 'true',
                  'headers[nc-import-type]': quickImportType,
                  'operation_id': operationId,
                  'typecast': isEeUI && autoInsertOption.value ? 'true' : undefined,
                },
                {
                  headers: {
                    'xc-auth': $state.token.value as string,
                    'nc-operation-id': operationId,
                    'nc-import-type': quickImportType,
                  },
                },
              )

              operationId = res.headers?.['nc-operation-id']
              updateImportTips(baseId, tableId!, progress, total)
              progress += batchData.length
              if (autoInsertOption.value) {
                await getMeta(tableId, true)
              }
            }
          })(key),
        ),
      )

      // reload table
      reloadHook.trigger()

      // Successfully imported table data
      message.success(t('msg.success.tableDataImported'))
    } catch (e: any) {
      console.log(e)
      throw e
    } finally {
      isImporting.value = false
    }
  } else {
    // check if form is valid
    try {
      await validate()
    } catch (errorInfo) {
      throw new Error('Please fill all the required values')
    }

    try {
      isImporting.value = true
      // collapse table
      expansionPanel.value = []
      // tab info to be used to show the tab after successful import
      const tab = {
        id: '',
        title: '',
        baseId: '',
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

        table.columns = table.columns?.filter((c) => !('selected' in c) || (c as any).selected)

        if (table.columns) {
          for (const column of table.columns) {
            // set pk & rqd if ID is provided
            if (column.column_name?.toLowerCase() === 'id' && !('pk' in column)) {
              column.pk = true
              column.rqd = true
            }
            if (
              (!isSystemColumn(column) || ['created_at', 'updated_at'].includes(column.column_name!)) &&
              column.uidt !== UITypes.SingleSelect &&
              column.uidt !== UITypes.MultiSelect
            ) {
              // delete dtxp if the final data type is not single & multi select
              // e.g. import -> detect as single / multi select -> switch to SingleLineText
              // the correct dtxp will be generated during column creation
              delete column.dtxp
            }
          }
        }
        const createdTable = await $api.source.tableCreate(base.value?.id as string, (sourceId || base.value?.sources?.[0].id)!, {
          table_name: table.table_name,
          // leave title empty to get a generated one based on table_name
          title: '',
          columns: table.columns || [],
        })

        if (process.env.NC_SANITIZE_COLUMN_NAME !== 'false') {
          // column_name could have been updated in tableCreate
          // e.g. sanitize column name to something like field_1, field_2, and etc
          // todo: see why we have extra columns when json is imported through pasting
          createdTable.columns.forEach((column, i) => {
            if (table.columns[i]) {
              table.columns[i].column_name = column.column_name
            }
          })
        }

        table.id = createdTable.id
        table.title = createdTable.title

        // open the first table after import
        if (tab.id === '' && tab.title === '' && tab.baseId === '') {
          tab.id = createdTable.id as string
          tab.title = createdTable.title as string
          tab.baseId = base.value.id as string
        }
      }

      // bulk insert data
      if (importData) {
        const offset = maxRowsToParse
        const baseName = base.value.title as string
        await Promise.all(
          data.tables.map((table: Record<string, any>) =>
            (async (tableMeta) => {
              let progress = 0
              let total = 0
              // use ref_table_name here instead of table_name
              // since importData[talbeMeta.table_name] would be empty after renaming
              const data = importData[tableMeta.ref_table_name]
              if (data) {
                total += data.length
                for (let i = 0; i < data.length; i += offset) {
                  updateImportTips(baseName, tableMeta.title, progress, total)
                  const batchData = remapColNames(data.slice(i, i + offset), tableMeta.columns)
                  await $api.dbTableRow.bulkCreate('noco', base.value.id, tableMeta.id, batchData)
                  progress += batchData.length
                }
                updateImportTips(baseName, tableMeta.title, total, total)
              }
            })(table),
          ),
        )
      }

      // Successfully imported table
      message.success(t(`msg.success.${data.tables.length > 1 ? 'tableImportedPlural' : 'tableImported'}`))

      // reload table list
      await loadProjectTables(base.value.id, true)

      addTab({
        ...tab,
        type: TabType.TABLE,
      })
    } catch (e: any) {
      console.log(e)
      throw e
    } finally {
      isImporting.value = false
    }
  }

  if (!data.tables?.length) return

  const tables = baseTables.value.get(base.value!.id!)
  const toBeNavigatedTable = tables?.find((t) => t.id === data.tables[0].id)
  if (!toBeNavigatedTable) return

  openTable(toBeNavigatedTable)
}

function mapDefaultColumns() {
  srcDestMapping.value = {}
  for (let i = 0; i < data.tables.length; i++) {
    for (const col of importColumns[i]) {
      const o = { srcCn: col.column_name, srcTitle: col.title, destCn: undefined, enabled: true }
      if (columns.value) {
        const tableColumn = columns.value.find((c) => c.title === col.title || c.column_name === col.column_name)
        if (tableColumn) {
          o.destCn = tableColumn.title as string
        } else {
          o.enabled = false
        }
      }
      if (!(data.tables[i].table_name in srcDestMapping.value)) {
        srcDestMapping.value[data.tables[i].table_name] = []
      }
      srcDestMapping.value[data.tables[i].table_name].push(o)
    }
  }
}

defineExpose({
  importTemplate,
  isValid,
  importError,
  updateImportError: (err: string) => {
    importError.value = err
  },
})

function getMappedColumns(tableName: string) {
  return (srcDestMapping.value[tableName] || []).filter((item) => item.destCn)
}

function isAllMappedSelected(tableName: string) {
  const cols = getMappedColumns(tableName)
  return !!cols.length && getMappedColumns(tableName).every((item) => item.enabled)
}

function isSomeMappedSelected(tableName: string) {
  const cols = getMappedColumns(tableName)

  return cols.length && getMappedColumns(tableName).some((item) => item.destCn && item.enabled)
}

function handleCheckAllRecord(event: CheckboxChangeEvent, tableName: string) {
  const isChecked = event.target.checked
  for (const record of srcDestMapping.value[tableName]) {
    if (!record.destCn && isChecked) continue

    record.enabled = isChecked
  }
}

const setErrorState = (errorsFields: any[]) => {
  const errorMap: any = {}
  for (const error of errorsFields) {
    errorMap[error.name] = error.errors
  }

  formError.value = errorMap
}

function populateUniqueColumnName(cn: string, draftCn: string[] = [], columns: ColumnType[]) {
  let c = 2
  let columnName = `${cn}${1}`
  while (
    draftCn.includes(columnName) ||
    columns?.some((c) => {
      return c.column_name === columnName || c.title === columnName
    })
  ) {
    columnName = `${cn}${c++}`
  }
  return columnName
}

watch(formRef, () => {
  setTimeout(async () => {
    try {
      await validate()
      emit('change')
      formError.value = null
    } catch (e: any) {
      emit('error', e)
      setErrorState(e.errorFields)
    }
  }, 500)
})

watch(modelRef, async () => {
  try {
    await validate()
    emit('change')
    formError.value = null
  } catch (e: any) {
    emit('error', e)
    setErrorState(e.errorFields)
  }
})

function toggleTableSelecteds(table: any) {
  if (table.columns.every((it: any) => it.selected)) {
    for (const column of table.columns) {
      column.selected = false
    }
  } else {
    for (const column of table.columns) {
      column.selected = true
    }
  }
}

const currentColumnToEdit = ref('')
const currentTableToEdit = ref<number | undefined>()

const getErrorForTable = (tableIdx: number) => {
  return (formError.value?.[`tables.${tableIdx}.table_name`] || []).concat(formError.value?.[`tables.${tableIdx}.columns`] || [])
}

function getErrorByTableName(tableName: string) {
  const errors = []

  const atLeastOneEnabledValidationErr = atLeastOneEnabledValidation(tableName)

  if (atLeastOneEnabledValidationErr) {
    errors.push(atLeastOneEnabledValidationErr)
  }

  const missingRequiredColumnsValidationErr = missingRequiredColumnsValidation(tableName)

  if (missingRequiredColumnsValidationErr) {
    errors.push(missingRequiredColumnsValidationErr)
  }

  return errors
}
</script>

<template>
  <div class="relative text-nc-content-gray">
    <div v-if="importDataOnly">
      <a-form :model="data" name="import-only">
        <p v-if="data.tables && quickImportType === 'excel'" class="text-center">
          {{ data.tables.length }} sheet{{ data.tables.length > 1 ? 's' : '' }}
          available for import
        </p>
      </a-form>

      <a-collapse
        v-if="data.tables && data.tables.length"
        v-model:activeKey="expansionPanel"
        class="template-collapse !rounded-lg !overflow-hidden"
        accordion
        expand-icon-position="right"
      >
        <template #expandIcon="{ isActive }">
          <GeneralIcon
            v-if="!isImporting"
            icon="ncChevronDown"
            class="text-lg !-translate-y-1/2 !transition text-nc-content-gray-subtle"
            :class="{ '!transform !rotate-180': isActive }"
          />
        </template>

        <a-collapse-panel
          v-for="(table, tableIdx) of data.tables"
          :key="tableIdx"
          class="nc-import-table-box nc-upload-box !overflow-hidden"
          :class="{
            'pointer-events-none': isImporting,
          }"
        >
          <template #header>
            <div
              class="flex items-center space-x-3 group min-h-8"
              :class="{
                'w-[calc(100%_-_30px)]': !isImporting,
                'w-full': isImporting,
              }"
            >
              <div class="w-8 h-8 flex items-center justify-center bg-nc-bg-gray-extralight rounded-md">
                <GeneralIcon :icon="tableIcon" class="w-5 h-5" />
              </div>
              <NcTooltip :title="table.table_name" show-on-truncate-only class="flex-1 truncate text-nc-content-gray">
                <span>
                  {{ table.table_name }}
                </span>
              </NcTooltip>
              <NcTooltip v-if="!isImporting && getErrorByTableName(table.table_name).length" class="ml-2">
                <template #title>
                  <div v-for="(err, idx) of getErrorByTableName(table.table_name)" :key="idx" class="mb-1 last-of-type:mb-0">
                    {{ idx > 0 ? `${idx + 1}.` : '' }} {{ err }}
                  </div>
                </template>
                <NcBadge color="red" :border="false" class="w-8 !px-2 flex-none !bg-nc-bg-red-light">
                  <GeneralIcon icon="ncInfo" class="text-nc-content-red-dark" />
                </NcBadge>
              </NcTooltip>
              <div v-if="isImporting" class="w-[150px]">
                <a-progress
                  :percent="importingTableTips[meta!.id!] ?? 0"
                  size="small"
                  status="normal"
                  stroke-color="#3366FF"
                  trail-color="#F0F3FF"
                />
              </div>
            </div>
          </template>
          <div v-if="srcDestMapping" class="bg-gray-50 pl-4 flex-1 flex">
            <NcTable
              class="template-form flex-1 max-h-[310px]"
              header-row-class-name="relative"
              body-row-class-name="template-form-row"
              :data="srcDestMapping[table.table_name]"
              :columns="srcDestMappingColumns"
              :bordered="false"
              header-row-height="40px"
              row-height="40px"
            >
              <template #headerCell="{ column }">
                <template v-if="column.key === 'source_column'">
                  <NcTooltip>
                    <template #title>
                      {{
                        isAllMappedSelected(table.table_name)
                          ? $t('activity.deselectAllFields')
                          : $t('tooltip.selectAllMappedFields')
                      }}
                    </template>
                    <div>
                      <NcCheckbox
                        :indeterminate="!isAllMappedSelected(table.table_name) && isSomeMappedSelected(table.table_name)"
                        :checked="isAllMappedSelected(table.table_name)"
                        @change="handleCheckAllRecord($event, table.table_name)"
                      />
                    </div>
                  </NcTooltip>
                  <div class="absolute h-1 border-b bottom-0 border-nc-border-gray-medium left-3 right-3" />
                </template>

                <span
                  v-if="column.key !== 'action'"
                  class="font-weight-700 text-nc-content-gray-subtle2 text-small"
                  :class="{
                    'pl-3': column.key !== 'source_column',
                  }"
                >
                  {{ column.title }}
                </span>
              </template>

              <template #bodyCell="{ column, record, recordIndex }">
                <div v-if="column.key === 'source_column'" class="w-full">
                  <label class="w-full flex items-center gap-3 h-full">
                    <NcTooltip :disabled="record.enabled || !!record.destCn">
                      <template #title>Select NocoDB field to map</template>
                      <NcCheckbox v-model:checked="record.enabled" :disabled="!record.destCn" />
                    </NcTooltip>

                    <NcTooltip
                      class="inline-block flex-1 max-w-[calc(100%_-_50px)] truncate text-nc-content-gray text-sm font-weight-500"
                      show-on-truncate-only
                    >
                      <template #title>{{ record.srcTitle }}</template>
                      {{ record.srcTitle }}
                    </NcTooltip>

                    <GeneralIcon icon="ncArrowRight" class="w-4 h-4 flex-shrink-0 mr-2" />
                  </label>
                  <div
                    v-if="recordIndex"
                    class="absolute h-1 border-t border-nc-border-gray-medium top-0 left-3 right-3 cursor-default"
                  />
                </div>

                <template v-else-if="column.key === 'destination_column'">
                  <a-form-item class="!my-0 w-full">
                    <NcSelect
                      v-model:value="record.destCn"
                      class="nc-field-select-input w-full nc-select-shadow !border-none"
                      show-search
                      allow-clear
                      :placeholder="`-${$t('labels.multiField.selectField').toLowerCase()}-`"
                      :filter-option="filterOption"
                      dropdown-class-name="nc-dropdown-filter-field"
                      @update:value="
                        (value) => {
                          record.enabled = !!value
                        }
                      "
                    >
                      <template #suffixIcon>
                        <GeneralIcon icon="arrowDown" class="text-current" />
                      </template>
                      <a-select-option
                        v-for="(col, i) of getUnselectedFields(record, table.table_name)"
                        :key="i"
                        :value="col.title"
                      >
                        <div class="flex items-center gap-2 w-full">
                          <component :is="getUIDTIcon(col.uidt)" class="flex-none w-3.5 h-3.5" />
                          <NcTooltip class="truncate flex-1" show-on-truncate-only>
                            <template #title>
                              {{ col.title }}
                            </template>
                            {{ col.title }}
                          </NcTooltip>
                          <component
                            :is="iconMap.check"
                            v-if="record.destCn === col.title"
                            id="nc-selected-item-icon"
                            class="flex-none text-primary w-4 h-4"
                          />
                        </div>
                      </a-select-option>
                    </NcSelect>
                  </a-form-item>
                </template>
              </template>
            </NcTable>
          </div>
        </a-collapse-panel>
      </a-collapse>

      <div v-if="isEeUI" class="pt-4 pr-2">
        <label class="flex">
          <NcCheckbox v-model:checked="autoInsertOption" :disabled="isImporting" />
          <span class="ml-2">{{ $t('labels.autoCreateMissingSelectionOptions') }}</span>
        </label>
      </div>
    </div>

    <a-card v-else class="!border-none !px-0 !mx-0" :body-style="{ padding: '0 !important' }">
      <a-form ref="formRef" :model="data" name="template-editor-form" @keydown.enter="emit('import')">
        <a-collapse
          v-if="data.tables && data.tables.length"
          v-model:activeKey="expansionPanel"
          class="template-collapse !rounded-lg !overflow-hidden"
          accordion
          expand-icon-position="right"
        >
          <template #expandIcon="{ isActive }">
            <GeneralIcon
              v-if="!isImporting"
              icon="ncChevronDown"
              class="text-lg !-translate-y-1/2 !transition text-nc-content-gray-subtle"
              :class="{ '!transform !rotate-180': isActive }"
            />
          </template>

          <a-collapse-panel v-for="(table, tableIdx) of data.tables" :key="tableIdx" class="nc-import-table-box !overflow-hidden">
            <template #header>
              <div
                class="flex items-center space-x-3 nc-table-name-wrapper group min-h-6"
                :class="{
                  'w-[calc(100%_-_30px)]': !isImporting,
                  'w-full': isImporting,
                }"
              >
                <GeneralIcon icon="table" class="w-4 h-4 text-nc-content-gray-subtle" />
                <a-form-item
                  v-if="!isImporting && currentTableToEdit === tableIdx"
                  v-bind="validateInfos[`tables.${tableIdx}.table_name`]"
                  class="!flex-1 !-my-1"
                >
                  <a-input
                    :ref="(el: HTMLInputElement) => el?.focus?.()"
                    v-model:value="table.table_name"
                    class="!rounded-md animate-sidebar-node-input-padding !text-nc-content-gray"
                    hide-details
                    :bordered="true"
                    @click.stop
                    @keydown.enter.prevent.stop="currentTableToEdit = undefined"
                    @keydown.esc.prevent.stop="currentTableToEdit = undefined"
                    @blur.prevent.stop="currentTableToEdit = undefined"
                  />
                </a-form-item>
                <template v-else>
                  <NcTooltip :title="table.table_name" show-on-truncate-only class="flex-1 truncate text-nc-content-gray">
                    <span class="nc-import-table-name" @click.stop="currentTableToEdit = tableIdx">
                      {{ table.table_name }}
                    </span>
                  </NcTooltip>
                  <NcButton
                    v-if="!isImporting"
                    type="text"
                    size="xsmall"
                    class="!hidden group-hover:!block !h-6 !w-6"
                    icon-only
                    @click.stop="currentTableToEdit = tableIdx"
                  >
                    <template #icon>
                      <GeneralIcon icon="pencil" class="text-nc-content-gray-subtle2" />
                    </template>
                  </NcButton>
                </template>

                <NcTooltip v-if="!isImporting && getErrorForTable(tableIdx).length" class="ml-2">
                  <template #title>
                    <div v-for="(err, idx) of getErrorForTable(tableIdx)" :key="idx" class="mb-1 last-of-type:mb-0">
                      {{ idx > 0 ? `${idx + 1}.` : '' }} {{ err }}
                    </div>
                  </template>
                  <NcBadge color="red" :border="false" class="w-8 !px-2 flex-none !bg-nc-bg-red-light">
                    <GeneralIcon icon="ncInfo" class="text-nc-content-red-dark" />
                  </NcBadge>
                </NcTooltip>

                <div v-if="isImporting" class="w-[150px]">
                  <a-progress
                    :percent="importingTableTips[table.title] ?? 0"
                    size="small"
                    status="normal"
                    stroke-color="#3366FF"
                    trail-color="#F0F3FF"
                  />
                </div>
              </div>
            </template>

            <div v-if="table.columns && table.columns.length" class="bg-nc-bg-gray-extralight pl-3 flex-1 flex">
              <NcTable
                class="template-form flex-1 max-h-[310px]"
                body-row-class-name="template-form-row"
                header-row-class-name="relative"
                :data="table.columns"
                :columns="tableColumns"
                :bordered="false"
                header-row-height="40px"
                row-height="40px"
                :pagination="table.columns.length > 50 ? { defaultPageSize: 50, position: ['bottomCenter'] } : false"
              >
                <template #headerCell="{ column }">
                  <template v-if="column.key === 'enabled'">
                    <NcCheckbox
                      :indeterminate="
                        table.columns.length &&
                        table.columns.some((it) => it.selected) &&
                        !table.columns.every((it) => it.selected)
                      "
                      :checked="table.columns.every((it) => it.selected)"
                      @click="toggleTableSelecteds(table)"
                    />
                  </template>
                  <template v-if="column.key === 'column_name'">
                    <span class="font-weight-700 text-small text-nc-content-gray-subtle2">
                      {{
                        table.columns.every((it) => it.selected)
                          ? $t('activity.deselectAllFields')
                          : $t('activity.selectAllFields')
                      }}
                    </span>
                    <div class="absolute h-1 border-b bottom-0 border-nc-border-gray-medium left-3 right-3" />
                  </template>
                </template>
                <template #bodyCell="{ column, record, recordIndex }">
                  <template v-if="column.key === 'enabled'">
                    <NcCheckbox v-model:checked="record.selected" />
                  </template>
                  <template v-if="column.key === 'column_name'">
                    <template v-if="`${tableIdx}-${record.column_name}` === currentColumnToEdit">
                      <a-form-item
                        v-bind="validateInfos[`tables.${tableIdx}.columns.${record.key}.title`]"
                        class="nc-table-field-name !mb-0 w-full"
                      >
                        <a-input
                          :ref="(el: HTMLInputElement) => {inputRefs[record.key] = el; el?.focus?.(); return el;}"
                          v-model:value="record.title"
                          class="!rounded-md animate-sidebar-node-input-padding !font-weight-500 !text-nc-content-gray"
                          :autofocus="true"
                          @keydown.enter.prevent.stop="currentColumnToEdit = ''"
                          @keydown.esc.prevent.stop="currentColumnToEdit = ''"
                          @blur.esc.prevent.stop="currentColumnToEdit = ''"
                        />
                      </a-form-item>
                    </template>
                    <template v-else>
                      <div
                        class="relative group w-full flex items-center min-h-6"
                        @click="currentColumnToEdit = `${tableIdx}-${record.column_name}`"
                      >
                        <span
                          class="font-weight-500 text-nc-content-gray max-w-[300px] inline-block truncate nc-import-table-field-name"
                        >
                          {{ record.title }}
                        </span>
                        <NcButton
                          type="text"
                          size="small"
                          class="!absolute right-0 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto"
                          @click="currentColumnToEdit = `${tableIdx}-${record.column_name}`"
                        >
                          <GeneralIcon icon="pencil" />
                        </NcButton>
                      </div>
                    </template>
                    <NcTooltip v-if="formError?.[`tables.${tableIdx}.columns.${record.key}.title`]" class="flex">
                      <template #title>
                        <div
                          v-for="(err, idx) of formError?.[`tables.${tableIdx}.columns.${record.key}.title`] || []"
                          :key="idx"
                          class="mb-1 last-of-type:mb-0"
                        >
                          {{ idx > 0 ? `${idx + 1}.` : '' }} {{ err }}
                        </div>
                      </template>
                      <GeneralIcon icon="info" class="h-4 w-4 text-nc-content-red-medium flex-none ml-2" />
                    </NcTooltip>
                    <div v-if="recordIndex" class="absolute h-1 border-t border-nc-border-gray-medium top-0 left-3 right-3" />
                  </template>
                </template>
              </NcTable>
            </div>
          </a-collapse-panel>
        </a-collapse>
      </a-form>
    </a-card>
  </div>
</template>

<style scoped lang="scss">
.template-collapse {
  @apply bg-white border-nc-border-gray-medium;
}

:deep(.ant-collapse-header) {
  @apply !items-center !py-2 !px-3;
  & > div {
    @apply flex;
  }
}
.nc-table-field-name {
  :deep(.ant-form-item-explain) {
    @apply hidden;
  }
}
:deep(.nc-import-table-box:last-child) {
  @apply !rounded-b-lg;
}
:deep(.nc-import-table-box .ant-collapse-content) {
  @apply !border-t-0;
}
:deep(.nc-import-table-box .ant-collapse-content-box) {
  @apply p-0;

  .nc-table-header-row,
  .nc-table-row {
    @apply !border-none relative;
  }
}
:deep(.nc-import-table-box.nc-upload-box .ant-collapse-content-box) {
  .nc-table-header-row {
    @apply !flex !h-auto !border-none !h-10;
    span {
      @apply !font-weight-700 text-[13px];
    }
  }
}

:deep(.nc-table-name-wrapper .ant-form-item-explain) {
  @apply hidden;
}

:deep(.ant-progress-outer) {
  margin-right: calc(-2em - 16px);
  padding-right: calc(2em + 16px);
}

:deep(.ant-progress-text) {
  @apply text-nc-content-gray-muted;
}

:deep(.nc-field-select-input.ant-select) {
  .ant-select-selector {
    @apply !bg-transparent rounded-lg;

    .ant-select-selection-item {
      @apply text-nc-content-gray text-sm font-weight-500;
    }
  }

  &:not(.ant-select-focused):hover .ant-select-selector {
    @apply !bg-nc-bg-gray-medium;
  }

  &:not(.ant-select-disabled):not(:hover):not(.ant-select-focused) .ant-select-selector,
  &:not(.ant-select-disabled):hover.ant-select-disabled .ant-select-selector {
    @apply !shadow-none;
  }

  &:hover:not(.ant-select-focused):not(.ant-select-disabled) .ant-select-selector {
    @apply shadow-none;
  }
  &:not(.ant-select-focused):not(.ant-select-disabled) .ant-select-selector {
    @apply !border-transparent;
  }

  &:not(.ant-select-focused):hover .ant-select-clear {
    @apply !bg-nc-bg-gray-medium;
  }
}
</style>
