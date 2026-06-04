<script setup lang="ts">
import type { ColumnType, TableType } from 'nocodb-sdk'
import { PermissionEntity, PermissionKey, RelationTypes, UITypes, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import type { CheckboxChangeEvent } from 'ant-design-vue/es/checkbox/interface'
import { srcDestMappingColumns, tableColumns } from './utils'

interface Props {
  quickImportType: 'csv' | 'excel' | 'json'
  baseTemplate: Record<string, any>
  importData: Record<string, any>
  importColumns: any[]
  importDataOnly: boolean
  maxRowsToParse: number
  /** Parser settings shared with QuickImport (firstRowAsHeaders, etc.). */
  parserConfig?: {
    firstRowAsHeaders?: boolean
    normalizeNested?: boolean
    autoSelectFieldTypes?: boolean
    maxRowsToParse?: number
  }
  /** What to do with parsed rows — mirrors FileImportOptions on the backend. */
  options?: {
    shouldImportData?: boolean
    importDataOnly?: boolean
    typecast?: boolean
  }
  baseId: string
  sourceId: string
  tableIcon?: string
}

interface Option {
  label: string
  value: string
}

const {
  quickImportType,
  baseTemplate,
  importData,
  importColumns,
  importDataOnly,
  maxRowsToParse,
  parserConfig,
  options,
  baseId,
  sourceId,
} = defineProps<Props>()

const emit = defineEmits(['import', 'error', 'change'])

const { t } = useI18n()

const { isAllowed } = usePermissions()

const { appInfo } = useGlobal()

const meta = inject(MetaInj, ref())

const DEFAULT_LINK_DELIMITER = ','

function getDestColumn(destCn?: string): ColumnType | undefined {
  if (!destCn) return undefined
  return (meta.value?.columns || []).find((c) => c.title === destCn)
}

function isLinkDest(destCn?: string): boolean {
  const col = getDestColumn(destCn)
  return !!col && isLinksOrLTAR(col)
}

// has-many / one-to-many / one-to-one links store an exclusive FK on the
// child record. Linking a child that already belongs to another record
// reassigns it — silently removing it from that other (existing) record.
// many-to-many (junction) and belongs-to (own FK) carry no such risk.
function isReassigningLinkDest(destCn?: string): boolean {
  const col = getDestColumn(destCn)
  if (!col || !isLinksOrLTAR(col)) return false
  const relationType = (col as any).colOptions?.type
  return (
    relationType === RelationTypes.HAS_MANY ||
    relationType === RelationTypes.ONE_TO_MANY ||
    relationType === RelationTypes.ONE_TO_ONE
  )
}

const filterForDestinationColumn = (col: ColumnType): boolean => {
  if ([UITypes.ForeignKey, UITypes.ID].includes(col.uidt as UITypes)) {
    return true
  }
  // Link columns are importable in data-only mode: their cells hold display
  // values resolved to record links in a post-insert phase on the backend.
  if (importDataOnly && isLinksOrLTAR(col)) {
    return true
  }
  return !isSystemColumn(col) && !isVirtualCol(col) && !isAttachment(col)
}

const columns = computed(() =>
  (meta.value?.columns || [])
    ?.filter((col) => filterForDestinationColumn(col))
    .map((col) => {
      // If it is import data only, then we need to check if the field is editable
      const isEditAllowed = importDataOnly ? isAllowed(PermissionEntity.FIELD, col.id!, PermissionKey.RECORD_FIELD_EDIT) : true

      // We allow to link record throw foreign key, so we don't need to check if the field is readonly
      const isReadonlyCol = col.readonly && col.uidt !== UITypes.ForeignKey

      return {
        ...col,
        readonly: isReadonlyCol || !isEditAllowed,
        permissions: {
          isEditAllowed,
          tooltip: isReadonlyCol
            ? t('msg.info.fieldReadonly')
            : !isEditAllowed
            ? t('tooltip.youDontHavePermissionToEditThisField')
            : '',
        },
      }
    }),
)

const reloadHook = inject(ReloadViewDataHookInj, createEventHook())

const useForm = Form.useForm

const { $api, $poller } = useNuxtApp()

const basesStore = useBases()

const { bases } = storeToRefs(basesStore)

const { activeWorkspace } = storeToRefs(useWorkspace())

const baseStore = useBase()

const { isMysql, isPg } = baseStore

const { base: activeBase } = storeToRefs(baseStore)

const base = computed(() => bases.value.get(baseId) || activeBase.value)

const tablesStore = useTablesStore()
const { openTable, loadProjectTables } = tablesStore
const { baseTables } = storeToRefs(tablesStore)

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
      {
        validator: (rule: any, value: any) => {
          return new Promise<void>((resolve, reject) => {
            let tableNameLengthLimit = 255
            if (isMysql(sourceId)) {
              tableNameLengthLimit = 64
            } else if (isPg(sourceId)) {
              tableNameLengthLimit = 63
            }

            const basePrefix = base?.value?.prefix || ''
            if ((basePrefix + value).length > tableNameLengthLimit) {
              return reject(new Error(`Table name exceeds ${tableNameLengthLimit} characters`))
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
  if ((srcDestMapping.value[tn] || []).filter((v: Record<string, any>) => v.enabled === true).length === 0) {
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

  if ((srcDestMapping.value[tn] || []).filter((v: Record<string, any>) => v.destCn === record.destCn).length > 1) {
    message.error(t('msg.error.duplicateMappingFound'))
    return false
  }

  const v = columns.value.find((c) => c.title === record.destCn) as Record<string, any>

  if (!v) {
    message.error(`Column '${record.destCn}' not found`)
    return false
  }

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
  const percent = total > 0 ? parseInt(`${(progress / total) * 100}`) : 0
  // Store with both table_name and title as key for template compatibility
  importingTableTips.value[tableName] = percent
}

interface ImportFinalStats {
  rowsInserted: number
  rowsFailed: number
  linksCreated?: number
  valuesUnmatched?: number
  sampleError?: string
}

// Show a row-aware toast for the data-import job: success when everything
// landed, a sticky error when nothing did, a warning for partial failures.
// Default `message.success` here was masking DB-level rejections (date /
// numeric / CHAR-width constraint errors etc.) because the poller treated
// every 'completed' event as a success regardless of failed-row counts.
function surfaceImportResult(stats: ImportFinalStats | undefined) {
  // Some link display values matched no record — surface a soft warning so the
  // user knows links were only partially created, but the import still ran.
  const warnUnmatchedLinks = () => {
    if (!stats?.valuesUnmatched) return
    message.warning({
      content: t('msg.warning.tableDataImportedLinksUnmatched', {
        links: stats.linksCreated ?? 0,
        unmatched: stats.valuesUnmatched,
      }),
      duration: 10,
    })
  }

  if (!stats || stats.rowsFailed === 0) {
    if (stats?.valuesUnmatched) {
      warnUnmatchedLinks()
      return
    }
    message.success(t('msg.success.tableDataImported'))
    return
  }

  const params: Record<string, string | number> = {
    inserted: stats.rowsInserted,
    failed: stats.rowsFailed,
  }
  if (stats.sampleError) params.error = stats.sampleError

  if (stats.rowsInserted === 0) {
    const key = stats.sampleError ? 'msg.error.tableDataImportFailedWithReason' : 'msg.error.tableDataImportFailed'
    // duration: 0 keeps the toast pinned until the user dismisses it
    message.error({
      content: t(key, params, stats.rowsFailed),
      duration: 0,
    })
  } else {
    const key = stats.sampleError ? 'msg.error.tableDataImportPartialWithReason' : 'msg.error.tableDataImportPartial'
    message.warning({
      content: t(key, params, stats.rowsFailed),
      duration: 10,
    })
  }

  // Row failures and unmatched links can co-occur; the partial-failure toast
  // above only reports rows, so surface skipped links as a separate warning.
  warnUnmatchedLinks()
}

// One import job per uploaded file. Each job carries all the sheets that
// came from that file, so the file is opened and deleted exactly once.
async function importViaJob() {
  isImporting.value = true
  expansionPanel.value = []

  let importFinalStats: ImportFinalStats | undefined

  try {
    if (!importDataOnly) await validate()

    const parserCfg = {
      firstRowAsHeaders:
        quickImportType === 'excel' || quickImportType === 'csv' ? parserConfig?.firstRowAsHeaders ?? true : false,
      normalizeNested: quickImportType === 'json' ? parserConfig?.normalizeNested ?? true : false,
      maxRowsToParse,
      autoSelectFieldTypes: parserConfig?.autoSelectFieldTypes ?? true,
    }
    const opts = {
      shouldImportData: options?.shouldImportData ?? true,
      importDataOnly,
      typecast: isEeUI && autoInsertOption.value,
    }

    // Group editor tables by the file they came from.
    const groups = new Map<any, typeof data.tables>()
    for (const table of data.tables) {
      const key = table._serverAttachment
      if (!groups.has(key)) groups.set(key, [] as any)
      groups.get(key)!.push(table)
    }

    for (const [attachment, tables] of groups) {
      const sheets: any[] = []
      const trackedNames: string[] = []
      const totals: Record<string, number> = {}

      for (const table of tables) {
        if (importDataOnly) {
          const errors = getErrorByTableName(table.table_name)
          if (errors.length) throw new Error(errors[0])
        }

        sheets.push({
          sheetName: table._sheetName,
          tableName: table.table_name,
          tableId: importDataOnly ? meta.value?.id : undefined,
          columns: (table.columns as any[])
            ?.filter((c) => !('selected' in c) || c.selected)
            .map((c) => ({
              title: c.title,
              column_name: c.column_name,
              uidt: c.uidt,
              key: c.key,
              meta: c.meta,
              dtxp: c.dtxp,
              path: c.path,
            })),
          columnMapping: importDataOnly
            ? srcDestMapping.value[table.table_name]?.map((m: any) => ({
                sourceCn: m.srcCn,
                destCn: m.destCn,
                enabled: m.enabled,
                ...(isLinkDest(m.destCn) ? { linkConfig: { delimiter: m.delimiter || DEFAULT_LINK_DELIMITER } } : {}),
              }))
            : undefined,
        })

        trackedNames.push(table.table_name)
        totals[table.table_name] = table._totalRows || 0
      }

      const jobResult = await $api.internal.postOperation(
        activeWorkspace.value?.id,
        base.value.id,
        {
          operation: 'dataImportFile',
          baseId: base.value.id,
          sourceId: sourceId || base.value?.sources?.[0]?.id,
        },
        {
          importType: quickImportType,
          sourceId: sourceId || base.value?.sources?.[0]?.id,
          attachment,
          parserConfig: parserCfg,
          options: opts,
          sheets,
        },
      )
      const jobId = (jobResult as any).id
      const baseName = base.value.title as string

      await new Promise<void>((resolve, reject) => {
        $poller.subscribe(
          { id: jobId },
          (pollerData: { id: string; status?: string; data?: { error?: { message: string }; message?: string } }) => {
            if (pollerData.status === 'close' || pollerData.status === 'completed') return resolve()
            if (pollerData.status === 'failed') {
              return reject(new Error(pollerData.data?.error?.message || 'Import failed'))
            }
            if (!pollerData.data?.message) return

            try {
              const progress = JSON.parse(pollerData.data.message)
              if (progress.status === 'progress') {
                const tname = trackedNames.includes(progress.tableName) ? progress.tableName : trackedNames[0]
                const total = totals[tname] || progress.totalProcessed || 0
                updateImportTips(baseName, tname, progress.totalProcessed || 0, total)
              } else if (progress.status === 'completed') {
                // Capture final counters so the toast below can distinguish
                // success / partial / total failure — without this the UI
                // always reports success even when the DB rejected rows.
                importFinalStats = {
                  rowsInserted: Number(progress.rowsInserted) || 0,
                  rowsFailed: Number(progress.rowsFailed) || 0,
                  linksCreated: Number(progress.linksCreated) || 0,
                  valuesUnmatched: Number(progress.valuesUnmatched) || 0,
                  sampleError: typeof progress.sampleError === 'string' ? progress.sampleError : undefined,
                }
              }
            } catch {
              // plain-text log — ignore
            }
          },
        )
      })
    }

    if (importDataOnly) {
      reloadHook.trigger()
      surfaceImportResult(importFinalStats)
    } else {
      await loadProjectTables(base.value.id, true)
      if (importFinalStats && importFinalStats.rowsFailed > 0) {
        surfaceImportResult(importFinalStats)
      } else {
        message.success(t(`msg.success.${data.tables.length > 1 ? 'tableImportedPlural' : 'tableImported'}`))
      }
    }
  } finally {
    isImporting.value = false
  }
}

async function importTemplate() {
  await importViaJob()

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
      const o = {
        srcCn: col.column_name,
        srcTitle: col.title,
        destCn: undefined,
        enabled: true,
        delimiter: DEFAULT_LINK_DELIMITER,
      }
      if (columns.value) {
        const tableColumn = columns.value.find((c) => !c.readonly && (c.title === col.title || c.column_name === col.column_name))
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

// Mapped destination titles that are has-many/one-to-many/one-to-one links —
// linking these can reassign records away from other rows. Surfaced as a
// full-width warning below the mapping table.
function reassigningLinkFields(tableName: string): string[] {
  return (srcDestMapping.value[tableName] || [])
    .filter((item) => item.enabled && isReassigningLinkDest(item.destCn))
    .map((item) => item.destCn as string)
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

const setErrorState = (errorsFields: any[] = []) => {
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
      setErrorState(e?.errorFields)
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
    setErrorState(e?.errorFields)
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
        v-model:active-key="expansionPanel"
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
                  :percent="importingTableTips[table.table_name] ?? 0"
                  size="small"
                  status="normal"
                  stroke-color="var(--nc-content-brand)"
                  trail-color="var(--nc-bg-brand-inverted)"
                />
              </div>
            </div>
          </template>
          <div v-if="srcDestMapping" class="bg-nc-bg-gray-extralight pl-4 flex-1 flex">
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
                        :disabled="col.readonly"
                      >
                        <div class="flex items-center gap-2 w-full">
                          <SmartsheetHeaderIcon
                            :column="col"
                            class="flex-none w-3.5 h-3.5 !mx-0"
                            color="text-nc-content-gray-muted"
                          />
                          <NcTooltip class="truncate flex-1" :show-on-truncate-only="!col.readonly">
                            <template #title>
                              {{ col.readonly ? col.permissions?.tooltip || t('msg.info.fieldReadonly') : col.title }}
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
                  <div v-if="isLinkDest(record.destCn)" class="flex items-center gap-2 mt-1.5 pl-1">
                    <NcTooltip class="text-tiny text-nc-content-gray-muted whitespace-nowrap">
                      <template #title>{{ $t('tooltip.linkValueDelimiter') }}</template>
                      {{ $t('labels.linkValueDelimiter') }}
                    </NcTooltip>
                    <a-input
                      v-model:value="record.delimiter"
                      class="!w-14 !rounded-md nc-link-delimiter-input"
                      size="small"
                      :maxlength="3"
                      :placeholder="DEFAULT_LINK_DELIMITER"
                      data-testid="nc-import-link-delimiter"
                    />
                  </div>
                </template>
              </template>
            </NcTable>
          </div>
          <div
            v-for="fieldName in reassigningLinkFields(table.table_name)"
            :key="`reassign-${fieldName}`"
            class="w-full flex items-start gap-2 px-4 py-2 bg-nc-bg-gray-extralight border-t border-nc-border-gray-light text-tiny text-nc-content-orange-medium"
            data-testid="nc-import-link-reassign-warning"
          >
            <GeneralIcon icon="ncAlertTriangle" class="w-4 h-4 flex-none mt-0.5" />
            <span class="flex-1">{{ $t('msg.warning.importLinkReassignField', { field: fieldName }) }}</span>
          </div>
        </a-collapse-panel>
      </a-collapse>

      <div v-if="appInfo.ee" class="pt-4 pr-2">
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
          v-model:active-key="expansionPanel"
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
                    :percent="importingTableTips[table.table_name] ?? 0"
                    size="small"
                    status="normal"
                    stroke-color="var(--nc-content-brand)"
                    trail-color="var(--nc-bg-brand-inverted)"
                  />
                </div>
              </div>
            </template>

            <div v-if="table.columns && table.columns.length" class="bg-nc-bg-gray-extralight pl-3 flex-1 flex max-h-[310px]">
              <NcTable
                class="template-form flex-1"
                body-row-class-name="template-form-row"
                header-row-class-name="relative"
                :data="table.columns"
                :columns="tableColumns"
                :bordered="false"
                header-row-height="40px"
                row-height="40px"
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
  @apply bg-nc-bg-default border-nc-border-gray-medium;
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
  @apply !p-0;

  .nc-table-header-row,
  .nc-table-row {
    @apply !border-none relative;
  }
}

:deep(.ant-collapse > .ant-collapse-item) {
  @apply !border-nc-border-gray-medium;
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
