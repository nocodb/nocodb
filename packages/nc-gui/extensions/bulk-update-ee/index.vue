<script setup lang="ts">
import { helpers } from '@vuelidate/validators'
import useVuelidate from '@vuelidate/core'

import {
  type ViewType,
  ViewTypes,
  UITypes,
  getSystemColumnsIds,
  type TableType,
  isVirtualCol,
  type PaginatedType,
} from 'nocodb-sdk'

const jobStatusTooltip = {
  [JobStatus.COMPLETED]: 'Export successful',
  [JobStatus.FAILED]: 'Export failed',
} as Record<string, string>

const hiddenColTypes = [
  UITypes.Rollup,
  UITypes.Lookup,
  UITypes.Formula,
  UITypes.QrCode,
  UITypes.Barcode,
  UITypes.Button,
  UITypes.SpecificDBType,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
  UITypes.CreatedBy,
  UITypes.LastModifiedBy,
]

interface BulkUpdatePayloadType {
  selectedTableId?: string
  selectedViewId?: string
  history: BulkUpdateHistory[]
}

interface BulkUpdateHistory {
  tableId?: string
  viewId?: string
  config: BulkUpdateFieldConfig[]
}

interface BulkUpdateFieldConfig {
  id: string
  columnId?: string
  uidt?: UITypes
  opType?: BulkUpdateFieldActionOpTypes
  subOpType?: BulkUpdateFieldActionOpTypes
  value?: any
  selected: boolean
}

enum BulkUpdateFieldActionOpTypes {
  CLEAR_VALUE = 'CLEAR_VALUE',
  SET_VALUE = 'SET_VALUE',
}

const { $api, $poller } = useNuxtApp()

const { appInfo } = useGlobal()

const router = useRouter()
const route = router.currentRoute

const activeTableId = computed(() => route.value.params.viewId as string | undefined)

const activeViewTitleOrId = computed(() => {
  return route.value.params.viewTitle
})

const bulkUpdatePayloadPlaceholder: BulkUpdatePayloadType = {
  selectedTableId: '',
  selectedViewId: '',
  history: [],
}

const bulkUpdateFieldConfigPlaceholder: BulkUpdateFieldConfig = {
  id: '',
  columnId: '',
  uidt: undefined,
  opType: undefined,
  subOpType: undefined,
  value: null,
  selected: true,
}

const { extension, tables, fullscreen, eventBus, getViewsForTable, getTableMeta, reloadData } = useExtensionHelperOrThrow()

const { jobList, loadJobsForBase } = useJobs()

const views = ref<ViewType[]>([])

const deletedExports = ref<string[]>([])

const bulkUpdateRef = ref<HTMLDivElement>()

const { width } = useElementSize(bulkUpdateRef)

const meta = ref<TableType>()

const formRef = ref()

const fieldConfigRef = ref()

const isOpenConfigModal = ref(false)

const isUpdating = ref(false)

const systemFieldsIds = computed(() => getSystemColumnsIds(meta.value?.columns || []))

const bulkUpdateColumns = computed(() => {
  return (meta.value?.columns || [])
    .filter((c) => {
      return !hiddenColTypes.includes(c.uidt) && !systemFieldsIds.value.includes(c.id) && !isVirtualCol(c) && !c.pk && !c.unique
    })
    .map((c) => {
      const disabled = c.uidt === UITypes.Attachment

      const tooltip = c.uidt === UITypes.Attachment ? 'Not supported' : ''

      return { ...c, disabled, tooltip }
    })
})

const savedPayloads = ref<BulkUpdatePayloadType>(bulkUpdatePayloadPlaceholder)

const tableList = computed(() => {
  return tables.value.map((table) => {
    return {
      label: table.title,
      value: table.id,
      meta: table.meta,
    }
  })
})

const viewList = computed(() => {
  if (!savedPayloads.value.selectedTableId) return []
  return (
    views.value
      .filter((view) => view.type === ViewTypes.GRID)
      .map((view) => {
        return {
          label: view.is_default ? `Default View` : view.title,
          value: view.id,
          meta: view.meta,
          type: view.type,
        }
      }) || []
  )
})

const isDataLoaded = ref(false)

const bulkUpdatePayload = computedAsync(async () => {
  if (!isDataLoaded.value && !savedPayloads.value.history?.length) {
    let saved = (await extension.value.kvStore.get('savedPayloads')) as BulkUpdatePayloadType

    if (saved) {
      saved.history = saved.history || []

      const deletedTableIds = new Set<string>()

      const deletedViewIds = new Set<string>()

      const availableTables: string[] = (tableList.value || []).map((t) => t.value) || []

      for (const h of saved.history) {
        if (h.tableId && !availableTables.includes(h.tableId)) {
          deletedTableIds.add(h.tableId)
        }
      }

      saved.history = saved.history.filter((h) => (h.tableId && deletedTableIds.has(h.tableId) ? false : true))

      if (saved.selectedTableId && deletedTableIds.has(saved.selectedTableId)) {
        saved.selectedTableId = ''
        saved.selectedViewId = ''
      }

      savedPayloads.value = saved

      await updateColumns()

      await reloadViews()

      /**
       * Todo: remove history object if table view is deleted
       */
      if (!savedPayloads.value.selectedTableId && tableList.value.find((table) => table.value === activeTableId.value)) {
        onTableSelect()
      }

      isDataLoaded.value = true
    } else {
      onTableSelect()
    }

    validateAll()
  }

  if (savedPayloads.value.selectedTableId && savedPayloads.value.selectedViewId) {
    const historyIndex = savedPayloads.value.history.findIndex(
      (h) => h.tableId === savedPayloads.value.selectedTableId && h.viewId === savedPayloads.value.selectedViewId,
    )

    if (historyIndex !== -1) {
      return savedPayloads.value.history[historyIndex]
    } else {
      savedPayloads.value.history.push({
        tableId: savedPayloads.value.selectedTableId,
        viewId: savedPayloads.value.selectedViewId,
        config: [],
      })

      return savedPayloads.value.history[savedPayloads.value.history.length - 1]
    }
  }
})

const fieldConfigMap = computed(() => {
  return (
    (bulkUpdatePayload.value?.config || []).reduce((acc, col) => {
      if (col.id) {
        acc[col.id] = col
      }
      return acc
    }, {} as Record<string, any>) || {}
  )
})

const fieldConfigMapByColumnId = computed(() => {
  return (
    (bulkUpdatePayload.value?.config || []).reduce((acc, col) => {
      if (col.columnId) {
        acc[col.columnId] = col
      }
      return acc
    }, {} as Record<string, any>) || {}
  )
})

const selectedFieldConfigForBulkUpdate = computed(() => {
  return (bulkUpdatePayload.value?.config || []).filter((config) => config.selected)
})

const fieldActionOptions: {
  label: string
  value: BulkUpdateFieldActionOpTypes
}[] = [
  {
    label: 'Clear cell contents',
    value: BulkUpdateFieldActionOpTypes.CLEAR_VALUE,
  },
  {
    label: 'Set cell values',
    value: BulkUpdateFieldActionOpTypes.SET_VALUE,
  },
]

async function reloadViews() {
  if (!savedPayloads.value.selectedTableId) return

  views.value = await getViewsForTable(savedPayloads.value.selectedTableId)
}

async function updateColumns() {
  if (!savedPayloads.value.selectedTableId) return

  const tableMeta = await getTableMeta(savedPayloads.value.selectedTableId)

  if (tableMeta) {
    meta.value = tableMeta
  }
}

const viewPageInfo = ref<PaginatedType>({})

const isLoadingViewInfo = ref(false)

async function loadViewData() {
  if (!meta.value || !savedPayloads.value.selectedTableId || !savedPayloads.value.selectedViewId) return

  isLoadingViewInfo.value = true

  try {
    const { pageInfo } = await $api.dbViewRow.list(
      'noco',
      meta.value.base_id!,
      savedPayloads.value.selectedTableId as string,
      savedPayloads.value.selectedViewId as string,
      {
        offset: 0,
        limit: 10,
      } as any,
    )

    viewPageInfo.value = pageInfo
  } catch (e) {
    console.error(e)
  } finally {
    isLoadingViewInfo.value = false
  }
}

async function onTableSelect(tableId?: string) {
  if (!tableId) {
    savedPayloads.value.selectedTableId = activeTableId.value
    await reloadViews()
    savedPayloads.value.selectedViewId = activeViewTitleOrId.value
      ? views.value.find((view) => view.type === ViewTypes.GRID && view.id === activeViewTitleOrId.value)?.id
      : views.value.find((view) => view.is_default)?.id
  } else {
    savedPayloads.value.selectedTableId = tableId
    await reloadViews()
    savedPayloads.value.selectedViewId = views.value.find((view) => view.is_default)?.id
  }

  await updateColumns()

  await saveChanges()
}

const onViewSelect = async (viewId: string) => {
  savedPayloads.value.selectedViewId = viewId

  await saveChanges()

  if (bulkUpdatePayload.value?.config?.length) {
    fieldConfigExpansionPanel.value = [bulkUpdatePayload.value?.config[0].columnId]
  }
}

const isExporting = ref(false)

const filterOption = (input: string, option: { key: string }) => {
  return option.key?.toLowerCase()?.includes(input?.toLowerCase())
}

async function saveChanges() {
  await extension.value.kvStore.set('savedPayloads', savedPayloads.value)
}

const fieldConfigExpansionPanel = ref<string[]>([])

const handleUpdateFieldConfigExpansionPanel = (key: string) => {
  if (!fullscreen.value) {
    fullscreen.value = true
  }
  if (fieldConfigExpansionPanel.value.includes(key)) {
    fieldConfigExpansionPanel.value = []
  } else {
    fieldConfigExpansionPanel.value = [key]
  }
  validateAll()
}

const getNewFieldConfigId = (initId = 'fieldConfig') => {
  let id = initId
  let i = 1
  while ((bulkUpdatePayload.value?.config || []).find((c) => c.id === id)) {
    id = `${initId}_${i}`
    i++
  }
  return id
}

function addNewAction() {
  if (!bulkUpdatePayload.value) return

  const configId = getNewFieldConfigId()

  bulkUpdatePayload.value.config = [
    ...(bulkUpdatePayload.value.config || []),
    { ...bulkUpdateFieldConfigPlaceholder, id: configId },
  ]

  if (!fullscreen.value) {
    fullscreen.value = true
  }

  handleUpdateFieldConfigExpansionPanel(configId)
  validateAll()

  nextTick(() => {
    setTimeout(() => {
      if (fieldConfigRef.value) {
        fieldConfigRef.value.scrollTop = fieldConfigRef.value.scrollHeight
      }
    }, 200)
  })
}

async function handleRemoveFieldConfig(configId: string) {
  if (!bulkUpdatePayload.value) return

  if (!bulkUpdatePayload.value?.config) {
    bulkUpdatePayload.value.config = []
  }

  bulkUpdatePayload.value.config = bulkUpdatePayload.value.config.filter((fc) => fc.id !== configId)

  await saveChanges()
  validateAll()
}

function handleFieldSelect(fieldConfig: BulkUpdateFieldConfig, columnId: string) {
  fieldConfig.columnId = columnId
  fieldConfig.uidt = meta?.value?.columnsById?.[columnId]?.uidt
  fieldConfig.value = null
}

const handleUpdateFieldValue = (columnId: string, value: any) => {
  const fieldConfig = bulkUpdatePayload.value?.config.find((f) => f.columnId === columnId)

  if (!fieldConfig) return

  fieldConfig.value = value

  saveChanges()
}

const rules = computed(() => {
  return (bulkUpdatePayload.value?.config || []).reduce((acc, config) => {
    if (!config?.id) return acc

    acc[config.id] = {
      columnId: {
        required: helpers.withMessage('Field is required', (value) => {
          if (!value) return false

          return true
        }),
        isColumnPresent: helpers.withMessage('Field is deleted from table', (value, _currentConfig) => {
          const currentConfig = _currentConfig as BulkUpdateFieldConfig

          if (!currentConfig?.columnId || !meta.value) return true

          const column = meta.value.columnsById?.[currentConfig.columnId]

          if (!column) {
            return false
          }

          return true
        }),
        isColumnTypeChanged: helpers.withMessage('', (value, _currentConfig) => {
          const currentConfig = _currentConfig as BulkUpdateFieldConfig

          if (!currentConfig?.columnId || !meta.value || !currentConfig?.uidt) return true

          const column = meta.value.columnsById?.[currentConfig.columnId]

          if (column && column.uidt !== currentConfig?.uidt) {
            handleUpdateFieldValue(currentConfig?.columnId, null)
          }

          return true
        }),
      },
      opType: {
        required: helpers.withMessage('Update type is required', (value, _currentConfig) => {
          const currentConfig = _currentConfig as BulkUpdateFieldConfig

          if (!currentConfig.columnId) return true

          if (!value) return false

          return true
        }),
      },
      value: {
        required: helpers.withMessage('Cell value is required', (value, _currentConfig) => {
          const currentConfig = _currentConfig as BulkUpdateFieldConfig

          if (
            !meta.value ||
            !currentConfig?.columnId ||
            !currentConfig?.opType ||
            currentConfig?.opType !== BulkUpdateFieldActionOpTypes.SET_VALUE
          ) {
            return true
          }

          const column = meta.value.columnsById?.[currentConfig.columnId]

          if (typeof value === 'string') {
            value = value.trim()
          }

          if (
            (column.uidt === UITypes.Checkbox && !value) ||
            (column.uidt !== UITypes.Checkbox && !requiredFieldValidatorFn(value))
          ) {
            return false
          }

          if (column.uidt === UITypes.Rating && (!value || Number(value) < 1)) {
            return false
          }

          return true
        }),
      },
    }

    return acc
  }, {})
})

// Use Vuelidate to create validation instance
const v$ = useVuelidate(rules, fieldConfigMap)

async function validateAll() {
  await v$.value?.$validate()
}

async function bulkUpdateView(data: Record<string, any>) {
  if (!meta.value || !bulkUpdatePayload.value?.viewId) return

  isUpdating.value = true
  try {
    await $api.dbTableRow.bulkUpdateAll(NOCO, meta.value.base_id as string, meta.value.id as string, data, {
      viewId: bulkUpdatePayload.value?.viewId,
    })

    message.success('Fields successfully bulk updated')
  } catch (e: any) {
    console.error(e)
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    reloadData()
    isUpdating.value = false
    isOpenConfigModal.value = false
  }
}

async function handleBulkUpdate() {
  const data = (bulkUpdatePayload.value?.config || []).reduce((acc, config) => {
    if (!config.selected) {
      return acc
    }

    if (config.columnId && meta.value?.columnsById?.[config.columnId]) {
      const column = meta.value.columnsById[config.columnId]

      if (!column.title) return acc

      acc[column.title] = config.opType === BulkUpdateFieldActionOpTypes.SET_VALUE ? config.value : null
    }
    return acc
  }, {} as Record<string, any>)

  bulkUpdateView(data)
}

const handleConfirmUpdate = async () => {
  await loadViewData()

  isOpenConfigModal.value = true
}

onClickOutside(formRef, (e) => {
  if (!fullscreen.value || (e.target as HTMLElement)?.closest(`.nc-bulk-update-add-action-section`)) return

  if ((e.target as HTMLElement) === fieldConfigRef.value) {
    fieldConfigExpansionPanel.value = []
  }

  validateAll()
})

watch(
  [() => fullscreen.value, () => bulkUpdatePayload.value?.viewId],
  ([isFullscreen, isViewChanged]) => {
    if (isFullscreen) {
      if (!bulkUpdatePayload.value?.config?.length) {
        addNewAction()
      }
    } else {
      fieldConfigExpansionPanel.value = []
    }
  },
  {
    immediate: true,
  },
)

eventBus.on((event) => {
  if (event === SmartsheetStoreEvents.FIELD_RELOAD && bulkUpdatePayload.value?.tableId === activeTableId.value) {
    updateColumns()
  }
})

const { state, row } = useProvideSmartsheetRowStore(
  ref({
    row: {},
    oldRow: {},
    rowMeta: { new: true },
  }),
)

provide(IsFormInj, ref(true))
provide(IsGalleryInj, ref(false))
</script>

<template>
  <ExtensionsExtensionWrapper>
    <template v-if="fullscreen" #headerExtra>
      <div
        class="nc-bulk-update-select-wrapper flex-1 flex items-center border-1 border-nc-border-gray-medium rounded-lg relative shadow-default max-w-[474px]"
      >
        <a-form-item class="!my-0 min-w-1/2">
          <NcSelect
            v-model:value="savedPayloads.selectedTableId"
            placeholder="-select table-"
            :disabled="isExporting"
            class="nc-bulk-update-table-select nc-select-shadow"
            :filter-option="filterOption"
            dropdown-class-name="w-[250px]"
            show-search
            @change="onTableSelect"
          >
            <a-select-option v-for="table of tableList" :key="table.label" :value="table.value">
              <div class="w-full flex items-center gap-2">
                <div class="min-w-5 flex items-center justify-center">
                  <GeneralTableIcon :meta="{ meta: table.meta }" class="text-gray-500" />
                </div>
                <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                  <template #title>{{ table.label }}</template>
                  <span>{{ table.label }}</span>
                </NcTooltip>
                <component
                  :is="iconMap.check"
                  v-if="savedPayloads.selectedTableId === table.value"
                  id="nc-selected-item-icon"
                  class="flex-none text-primary w-4 h-4"
                />
              </div>
            </a-select-option>
          </NcSelect>
        </a-form-item>

        <a-form-item class="!my-0 min-w-1/2">
          <NcSelect
            v-model:value="savedPayloads.selectedViewId"
            placeholder="-select view-"
            :disabled="isExporting"
            class="nc-bulk-update-view-select nc-select-shadow"
            dropdown-class-name="w-[250px]"
            :filter-option="filterOption"
            show-search
            placement="bottomRight"
            @change="onViewSelect"
          >
            <a-select-option v-for="view of viewList" :key="view.label" :value="view.value">
              <div class="w-full flex items-center gap-2">
                <div class="min-w-5 flex items-center justify-center">
                  <GeneralViewIcon :meta="{ meta: view.meta, type: view.type }" class="flex-none text-gray-500" />
                </div>
                <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                  <template #title>{{ view.label }}</template>
                  <span>{{ view.label }}</span>
                </NcTooltip>
                <component
                  :is="iconMap.check"
                  v-if="savedPayloads.selectedViewId === view.value"
                  id="nc-selected-item-icon"
                  class="flex-none text-primary w-4 h-4"
                />
              </div> </a-select-option
          ></NcSelect>
        </a-form-item>
      </div>
      <NcButton
        size="small"
        :disabled="v$.$error || !selectedFieldConfigForBulkUpdate.length || isLoadingViewInfo"
        :loading="isLoadingViewInfo"
        @click="handleConfirmUpdate"
      >
        Update Records
      </NcButton>
    </template>

    <div
      ref="bulkUpdateRef"
      class="bulk-update-ee h-full flex flex-col"
      :class="{
        'gap-6 bg-nc-bg-gray-extralight': fullscreen,
      }"
    >
      <div v-if="!fullscreen" class="p-3 flex">
        <div
          class="nc-bulk-update-select-wrapper flex-1 flex items-center border-1 border-nc-border-gray-medium rounded-lg relative shadow-default max-w-[474px]"
        >
          <a-form-item class="!my-0 min-w-1/2">
            <NcSelect
              v-model:value="savedPayloads.selectedTableId"
              placeholder="-select table-"
              :disabled="isExporting"
              class="nc-bulk-update-table-select nc-select-shadow"
              :filter-option="filterOption"
              dropdown-class-name="w-[250px]"
              show-search
              size="large"
              @change="onTableSelect"
            >
              <a-select-option v-for="table of tableList" :key="table.label" :value="table.value">
                <div class="w-full flex items-center gap-2">
                  <div class="min-w-5 flex items-center justify-center">
                    <GeneralTableIcon :meta="{ meta: table.meta }" class="text-gray-500" />
                  </div>
                  <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                    <template #title>{{ table.label }}</template>
                    <span>{{ table.label }}</span>
                  </NcTooltip>
                  <component
                    :is="iconMap.check"
                    v-if="savedPayloads.selectedTableId === table.value"
                    id="nc-selected-item-icon"
                    class="flex-none text-primary w-4 h-4"
                  />
                </div>
              </a-select-option>
            </NcSelect>
          </a-form-item>

          <a-form-item class="!my-0 min-w-1/2">
            <NcSelect
              v-model:value="savedPayloads.selectedViewId"
              placeholder="-select view-"
              :disabled="isExporting"
              class="nc-bulk-update-view-select nc-select-shadow"
              dropdown-class-name="w-[250px]"
              :filter-option="filterOption"
              show-search
              size="large"
              placement="bottomRight"
              @change="onViewSelect"
            >
              <a-select-option v-for="view of viewList" :key="view.label" :value="view.value">
                <div class="w-full flex items-center gap-2">
                  <div class="min-w-5 flex items-center justify-center">
                    <GeneralViewIcon :meta="{ meta: view.meta, type: view.type }" class="flex-none text-gray-500" />
                  </div>
                  <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                    <template #title>{{ view.label }}</template>
                    <span>{{ view.label }}</span>
                  </NcTooltip>
                  <component
                    :is="iconMap.check"
                    v-if="savedPayloads.selectedViewId === view.value"
                    id="nc-selected-item-icon"
                    class="flex-none text-primary w-4 h-4"
                  />
                </div> </a-select-option
            ></NcSelect>
          </a-form-item>
        </div>
      </div>
      <div class="bulk-update-body flex-1 flex flex-col">
        <div v-if="!fullscreen" class="bulk-update-header">Actions</div>
        <div
          ref="fieldConfigRef"
          class="nc-field-config-ref flex-1 flex flex-col nc-scrollbar-thin"
          :class="{
            'pt-6 px-4 relative': fullscreen,
            'max-h-[calc(100%_-_25px)]': !fullscreen,
          }"
        >
          <div
            class="flex-1 flex flex-col gap-6 w-full"
            :class="{
              'max-w-[520px] mx-auto': fullscreen,
            }"
          >
            <div v-if="fullscreen" class="flex items-center gap-3">
              <div class="text-nc-content-gray-subtle2">
                {{ selectedFieldConfigForBulkUpdate.length }} fields set for bulk update
              </div>
            </div>

            <a-form
              ref="formRef"
              no-style
              name="column-create-or-edit"
              layout="vertical"
              class=""
              :class="{
                'border-1 border-nc-border-gray-medium rounded-2xl bg-white': fullscreen,
                'flex-1 flex': !fullscreen,
              }"
            >
              <a-collapse
                v-if="bulkUpdatePayload?.config?.length"
                v-model:active-key="fieldConfigExpansionPanel"
                class="nc-bulk-update-field-config-section flex flex-col w-full"
              >
                <template #expandIcon> </template>
                <a-collapse-panel v-for="fieldConfig in bulkUpdatePayload?.config" :key="fieldConfig.id" collapsible="disabled">
                  <template #header>
                    <div
                      v-if="!fieldConfigExpansionPanel.includes(fieldConfig.id)"
                      class="w-full flex items-center"
                      :class="{
                        'p-6': fullscreen,
                        'p-4': !fullscreen,
                      }"
                      @click="handleUpdateFieldConfigExpansionPanel(fieldConfig.id)"
                    >
                      <div v-if="v$?.[fieldConfig.id]?.$error" class="flex-1 flex">
                        <div
                          class="text-nc-content-red-dark rounded-md px-1 inline-flex items-center gap-1 text-sm bg-nc-bg-red-light"
                        >
                          <GeneralIcon icon="ncAlertTriangle" />
                          Incomplete configuration
                        </div>
                      </div>

                      <div v-else class="flex-1 flex text-nc-content-gray">
                        <div class="flex items-center gap-3">
                          <NcCheckbox v-model:checked="fieldConfig.selected" @click.stop />
                          <div class="flex items-center gap-1">
                            {{ fieldConfig.opType === BulkUpdateFieldActionOpTypes.CLEAR_VALUE ? 'Clear' : 'Set' }}
                            <NcBadge color="grey" :border="false" class="inline-flex items-center gap-1 !bg-nc-bg-gray-medium">
                              <component
                                :is="getUIDTIcon(UITypes[meta?.columnsById?.[fieldConfig.columnId]?.uidt])"
                                class="h-3.5 w-3.5"
                              />

                              <NcTooltip class="truncate max-w-[100px]" show-on-truncate-only>
                                <template #title>
                                  {{ meta?.columnsById?.[fieldConfig.columnId]?.title }}
                                </template>
                                {{ meta?.columnsById?.[fieldConfig.columnId]?.title }}
                              </NcTooltip>
                            </NcBadge>
                            {{
                              fieldConfig.opType === BulkUpdateFieldActionOpTypes.CLEAR_VALUE
                                ? ''
                                : fieldConfig.opType === BulkUpdateFieldActionOpTypes.SET_VALUE
                                ? 'to'
                                : ''
                            }}
                            <LazySmartsheetPlainCell
                              v-if="fieldConfig.opType === BulkUpdateFieldActionOpTypes.SET_VALUE && !!fieldConfig.value"
                              v-model="fieldConfig.value"
                              :column="meta?.columnsById?.[fieldConfig.columnId]"
                              class="field-config-plain-cell-value"
                            />
                          </div>
                        </div>
                      </div>
                      <NcButton
                        size="xs"
                        type="text"
                        icon-only
                        class="!px-0 -my-1"
                        @click.stop="handleRemoveFieldConfig(fieldConfig.id)"
                      >
                        <template #icon>
                          <GeneralIcon icon="delete" />
                        </template>
                      </NcButton>
                    </div>
                  </template>
                  <div class="w-full flex flex-col gap-6 p-6">
                    <a-form-item
                      class="!my-0 w-full nc-input-required-error"
                      v-bind="{
                        validateStatus: v$?.[fieldConfig.id]?.columnId?.$error ? 'error' : 'success',
                        help: v$?.[fieldConfig.id]?.columnId?.$errors?.map((er) => er.$message) || [],
                      }"
                    >
                      <template #label>
                        <span>Select field</span>
                      </template>
                      <NcSelect
                        :value="fieldConfig.columnId || undefined"
                        class="nc-field-select-input w-full nc-select-shadow"
                        placeholder="-select a field-"
                        @update:value="(value) => handleFieldSelect(fieldConfig, value)"
                        @change="saveChanges()"
                      >
                        <a-select-option
                          v-for="(col, i) of bulkUpdateColumns"
                          :key="i"
                          :value="col.id"
                          :disabled="col.disabled || (!!fieldConfigMapByColumnId[col.id!] && fieldConfig.columnId !== col.id)"
                        >
                          <NcTooltip
                            class="w-full"
                            placement="right"
                            :disabled="!(col.disabled || (!!fieldConfigMapByColumnId[col.id!] && fieldConfig.columnId !== col.id))"
                          >
                            <template #title>
                              {{ col.disabled ? col.tooltip : 'Already added' }}
                            </template>
                            <div class="flex items-center gap-2 w-full">
                              <component :is="getUIDTIcon(UITypes[col.uidt])" class="h-3.5 w-3.5" />

                              <NcTooltip
                                class="truncate flex-1"
                                :disabled="col.disabled || !col.tooltip || (!!fieldConfigMapByColumnId[col.id!] && fieldConfig.columnId !== col.id)"
                                show-on-truncate-only
                              >
                                <template #title>
                                  {{ col.title }}
                                </template>
                                {{ col.title }}
                              </NcTooltip>
                              <component
                                :is="iconMap.check"
                                v-if="fieldConfig.columnId === col.id"
                                id="nc-selected-item-icon"
                                class="flex-none text-primary w-4 h-4"
                              />
                            </div>
                          </NcTooltip>
                        </a-select-option>
                      </NcSelect>
                    </a-form-item>
                    <a-form-item
                      class="!my-0 w-full nc-input-required-error"
                      v-bind="{
                        validateStatus: v$?.[fieldConfig.id]?.opType?.$error ? 'error' : 'success',
                        help: v$?.[fieldConfig.id]?.opType?.$errors?.map((er) => er.$message) || [],
                      }"
                    >
                      <template #label>
                        <span>Update type</span>
                      </template>
                      <NcSelect
                        :value="fieldConfig.opType || undefined"
                        :disabled="!fieldConfig.columnId"
                        class="nc-field-update-type-select-input w-full nc-select-shadow"
                        placeholder="-select an update type-"
                        @update:value="
                          (value) => {
                            fieldConfig.opType = value
                            fieldConfig.value = null
                          }
                        "
                        @change="saveChanges()"
                      >
                        <a-select-option v-for="(action, i) of fieldActionOptions" :key="i" :value="action.value">
                          <div class="flex items-center gap-2 w-full">
                            <NcTooltip class="truncate flex-1" show-on-truncate-only>
                              <template #title>
                                {{ action.label }}
                              </template>
                              {{ action.label }}
                            </NcTooltip>
                            <component
                              :is="iconMap.check"
                              v-if="fieldConfig.opType === action.value"
                              id="nc-selected-item-icon"
                              class="flex-none text-primary w-4 h-4"
                            />
                          </div>
                        </a-select-option>
                      </NcSelect>
                    </a-form-item>

                    <a-form-item
                      v-if="
                        fieldConfig.columnId &&
                        !!meta?.columnsById?.[fieldConfig.columnId] &&
                        fieldConfig.opType === BulkUpdateFieldActionOpTypes.SET_VALUE
                      "
                      class="!my-0 w-full nc-input-required-error"
                      v-bind="{
                        validateStatus: v$?.[fieldConfig.id]?.value?.$error ? 'error' : 'success',
                        help: v$?.[fieldConfig.id]?.value?.$errors?.map((er) => er.$message) || [],
                      }"
                    >
                      <template #label>
                        <span> Set cell value to</span>
                      </template>

                      <LazySmartsheetDivDataCell
                        class="relative min-h-8"
                        :key="meta?.columnsById?.[fieldConfig.columnId]?.uidt"
                        :data-label="meta?.columnsById?.[fieldConfig.columnId]?.uidt"
                        :data-ver="isVirtualCol(meta?.columnsById?.[fieldConfig.columnId])"
                        @click.stop
                      >
                        <LazySmartsheetVirtualCell
                          v-if="isVirtualCol(meta?.columnsById?.[fieldConfig.columnId])"
                          v-model="fieldConfig.value"
                          :row="row"
                          class="nc-input"
                          :column="meta.columnsById[fieldConfig.columnId]"
                          @update:model-value="saveChanges()"
                        />
                        <LazySmartsheetCell
                          v-else
                          v-model="fieldConfig.value"
                          class="nc-input truncate"
                          :column="meta.columnsById[fieldConfig.columnId]"
                          :edit-enabled="true"
                          @update:model-value="saveChanges()"
                        />
                      </LazySmartsheetDivDataCell>
                    </a-form-item>

                    <div>
                      <NcButton type="text" size="xs" @click="handleRemoveFieldConfig(fieldConfig.id)">
                        <template #icon>
                          <GeneralIcon icon="delete" />
                        </template>
                        Remove update
                      </NcButton>
                    </div>
                  </div>
                </a-collapse-panel>
              </a-collapse>

              <div
                v-else
                class="text-gray-600"
                :class="{
                  'p-6 text-center': fullscreen,
                  'px-3 py-4 min-h-[120px] flex-1 flex flex-col gap-3 items-center justify-center': !fullscreen,
                }"
              >
                <div>No fields set</div>
                <NcButton v-if="!fullscreen" size="small" @click="addNewAction">
                  <template #icon>
                    <GeneralIcon icon="ncPlus" />
                  </template>
                  Add fields to update
                </NcButton>
              </div>
            </a-form>

            <div v-if="fullscreen" class="nc-bulk-update-add-action-section sticky bottom-0 py-6 bg-nc-bg-gray-extralight -mt-6">
              <NcButton type="secondary" size="medium" class="w-full" @click="addNewAction">
                <template #icon>
                  <GeneralIcon icon="ncPlus" />
                </template>
                New action
              </NcButton>
            </div>
          </div>
        </div>
      </div>
    </div>
    <NcModal v-model:visible="isOpenConfigModal" class="" :show-separator="false" size="small" :mask-closable="!isUpdating">
      <div class="flex flex-col gap-5">
        <div class="flex flex-col gap-2">
          <div class="text-base text-nc-content-gray-emphasis font-bold">Confirm bulk update</div>
          <div class="text-sm text-nc-content-gray-emphasis">
            {{ selectedFieldConfigForBulkUpdate.length }} field values from {{ viewPageInfo.totalRows }} records will be updated
          </div>
        </div>
        <div class="flex items-center gap-3 justify-end">
          <NcButton size="small" type="secondary" :disabled="isUpdating" @click="isOpenConfigModal = false">Cancel</NcButton>
          <NcButton size="small" :disabled="isUpdating" :loading="isUpdating" @click="handleBulkUpdate">{{
            isUpdating ? 'Updating records' : 'Confirm Update'
          }}</NcButton>
        </div>
      </div>
    </NcModal>
  </ExtensionsExtensionWrapper>
</template>

<style lang="scss" scoped></style>

<style lang="scss">
.nc-nc-bulk-update {
  @apply flex flex-col overflow-hidden h-full;
  .bulk-update-header {
    @apply px-3 py-1 bg-gray-100 text-[11px] leading-4 text-gray-600 border-b-1;
  }
  .nc-bulk-update-select-wrapper {
    &:not(:focus-within) {
      &::after {
        @apply absolute left-1/2 h-full content-[''] border-r-1 border-nc-border-gray-medium;
      }
    }
  }
  .nc-bulk-update-table-select.ant-select {
    &.ant-select-focused {
      .ant-select-selector {
        @apply z-10 !rounded-r-lg;
      }
    }
    &:not(.ant-select-focused) {
      .ant-select-selector {
        @apply !border-transparent !shadow-none;
      }
    }
    .ant-select-selector {
      @apply relative !rounded-lg !text-sm;
    }
  }
  .nc-bulk-update-view-select.ant-select {
    &.ant-select-focused {
      .ant-select-selector {
        @apply z-10 !rounded-l-lg;
      }
    }
    &:not(.ant-select-focused) {
      .ant-select-selector {
        @apply !border-transparent !shadow-none;
      }
    }
    .ant-select-selector {
      @apply relative !rounded-lg !text-sm;
    }
  }

  .nc-bulk-update-field-config-section.ant-collapse {
    @apply !rounded-2xl bg-white overflow-hidden !border-0 bg-transparent;

    .ant-collapse-header {
      @apply !p-0 flex items-center !cursor-default children:first:flex;
    }
    .nc-bulk-update-field-config-section .ant-collapse-header {
      @apply !cursor-pointer;
    }
    .ant-collapse-icon-position-right > .ant-collapse-item > .ant-collapse-header .ant-collapse-arrow {
      @apply !right-0;
    }
    .ant-collapse-content-box {
      @apply !p-0;
    }

    .ant-collapse-item {
      @apply border-b-nc-border-gray-medium last:(border-b-0 !rounded-b-lg overflow-hidden);
      .ant-collapse-content {
        @apply border-0;
      }
    }
  }

  .extension-content {
    &:not(.fullscreen) {
      .ant-collapse-item {
        @apply last:(border-b-1 !rounded-b-none);
      }
    }
  }

  .nc-field-select-input {
    .ant-select-selector {
      @apply !rounded-lg;
    }
  }
}
</style>

<style lang="scss" scoped>
:deep(.ant-select-selector) {
  @apply !xs:(h-full);
}

.bulk-update-body {
  @apply flex-1 overflow-hidden;
}

:deep(.field-config-plain-cell-value.plain-cell) {
  &::before {
    content: '';
    padding: 0 0;
  }
}

.nc-data-cell {
  @apply !rounded-lg;
  transition: all 0.3s;

  &:not(.nc-readonly-div-data-cell):not(.nc-system-field):not(.nc-attachment-cell):not(.nc-virtual-cell-button) {
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
  }
  &:not(:focus-within):hover:not(.nc-readonly-div-data-cell):not(.nc-system-field):not(.nc-virtual-cell-button) {
    @apply !border-1;
    &:not(.nc-attachment-cell):not(.nc-virtual-cell-button) {
      box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.24);
    }
  }

  &.nc-readonly-div-data-cell,
  &.nc-system-field {
    @apply !border-gray-200;

    :deep(.nc-cell),
    :deep(.nc-virtual-cell) {
      @apply text-gray-400;
    }
  }

  :deep(.nc-cell),
  :deep(.nc-virtual-cell) {
    &:not(.nc-cell-checkbox) {
      @apply bg-white dark:bg-slate-500;

      &.nc-input {
        @apply w-full h-8;
      }
    }
  }
  &.nc-readonly-div-data-cell:focus-within,
  &.nc-system-field:focus-within {
    @apply !border-gray-200;
  }

  &:focus-within:not(.nc-readonly-div-data-cell):not(.nc-system-field) {
    @apply !shadow-selected;
  }

  &:has(.nc-virtual-cell-qrcode .nc-qrcode-container),
  &:has(.nc-virtual-cell-barcode .nc-barcode-container) {
    @apply !border-none px-0 !rounded-none;
    :deep(.nc-virtual-cell-qrcode),
    :deep(.nc-virtual-cell-barcode) {
      @apply px-0;
      & > div {
        @apply !px-0;
      }
      .barcode-wrapper {
        @apply ml-0;
      }
    }
    :deep(.nc-virtual-cell-qrcode) {
      img {
        @apply !h-[84px] border-1 border-solid border-gray-200 rounded;
      }
    }
    :deep(.nc-virtual-cell-barcode) {
      .nc-barcode-container {
        @apply border-1 rounded-lg border-gray-200 h-[64px] max-w-full p-2;
        svg {
          @apply !h-full;
        }
      }
    }
  }
}
.nc-data-cell:focus-within {
  @apply !border-1 !border-brand-500;
}

:deep(.nc-system-field input) {
  @apply bg-transparent;
}
:deep(.nc-data-cell .nc-cell .nc-cell-field) {
  @apply px-2;
}
:deep(.nc-data-cell .nc-virtual-cell .nc-cell-field) {
  @apply px-2;
}
:deep(.nc-data-cell .nc-cell-field.nc-lookup-cell .nc-cell-field) {
  @apply px-0;
}

.nc-input-required-error {
  &:focus-within {
    :deep(.ant-form-item-explain-error) {
      @apply text-gray-400;
    }
  }
}

:deep(.ant-form-item-has-error .nc-data-cell .ant-select:not(.ant-select-disabled) .ant-select-selector) {
  border: none !important;
}
:deep(.ant-form-item-has-success .nc-data-cell .ant-select:not(.ant-select-disabled) .ant-select-selector) {
  border: none !important;
}
</style>
