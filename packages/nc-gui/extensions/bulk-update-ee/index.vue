<script setup lang="ts">
import { helpers } from '@vuelidate/validators'
import useVuelidate from '@vuelidate/core'
import isMobilePhone from 'validator/lib/isMobilePhone'

import {
  type PaginatedType,
  type TableType,
  UITypes,
  type ViewType,
  ViewTypes,
  getSystemColumnsIds,
  isVirtualCol,
} from 'nocodb-sdk'

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

const { $api, $e } = useNuxtApp()

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
const EXTENSION_ID = extension.value.extensionId

const views = ref<ViewType[]>([])

const meta = ref<TableType>()

const formRef = ref()

const fieldConfigRef = ref<HTMLDivElement>()

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

const fieldConfigExpansionPanel = ref<string[]>([])

const bulkUpdatePayload = computedAsync(async () => {
  if (!isDataLoaded.value && !savedPayloads.value.history?.length) {
    const saved = (await extension.value.kvStore.get('savedPayloads')) as BulkUpdatePayloadType

    if (saved) {
      saved.history = saved.history || []

      const deletedTableIds = new Set<string>()

      const availableTables: string[] = (tableList.value || []).map((t) => t.value) || []

      for (const h of saved.history) {
        if (h.tableId && !availableTables.includes(h.tableId)) {
          deletedTableIds.add(h.tableId)
        }
      }

      saved.history = saved.history.filter((h) => !(h.tableId && deletedTableIds.has(h.tableId)))

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

const isAllFieldSelected = computed(() => {
  return bulkUpdateColumns.value.every((column) => !!fieldConfigMapByColumnId.value[column?.id])
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

const showNoRecordToUpdateInlineToast = ref(false)

async function loadViewData() {
  if (!meta.value || !savedPayloads.value.selectedTableId || !savedPayloads.value.selectedViewId) return

  isLoadingViewInfo.value = true
  showNoRecordToUpdateInlineToast.value = false

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

    if (!viewPageInfo.value?.totalRows) {
      if (fullscreen.value) {
        showNoRecordToUpdateInlineToast.value = true
      } else {
        message.warning('No Records to Update')
      }
    } else {
      isOpenConfigModal.value = true
    }
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
    fieldConfigExpansionPanel.value = [bulkUpdatePayload.value?.config[0].id]

    handleAutoScrollField(bulkUpdatePayload.value?.config[0].id)
  }
}

const isExporting = ref(false)

const filterOption = (input: string, option: { key: string }) => {
  return option.key?.toLowerCase()?.includes(input?.toLowerCase())
}

async function saveChanges() {
  await extension.value.kvStore.set('savedPayloads', savedPayloads.value)
}

const handleUpdateFieldConfigExpansionPanel = (key: string, expand = false) => {
  if (!fullscreen.value) {
    fullscreen.value = true
  }
  if (!expand && fieldConfigExpansionPanel.value.includes(key)) {
    fieldConfigExpansionPanel.value = []
  } else {
    fieldConfigExpansionPanel.value = [key]
    handleAutoScrollField(key)
  }

  validateAll()

  handleScroll()
}

const usedFieldConfigIds = ref<string[]>([])

const getNewFieldConfigId = (initId = 'fieldConfig') => {
  let id = initId
  let i = 1

  while ((bulkUpdatePayload.value?.config || []).find((c) => c.id === id) || usedFieldConfigIds.value.includes(id)) {
    id = `${initId}_${i}`
    i++
  }

  usedFieldConfigIds.value.push(id)

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

  handleUpdateFieldConfigExpansionPanel(configId, true)

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

  handleScroll()
}

async function handleAutoScrollField(configId: string) {
  if (!formRef.value) return

  await ncDelay(400)

  const field = formRef.value?.$el?.querySelector(`.nc-bulk-update-field-confit-${configId}`)

  if (!field) return

  field.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

const isScrolledToBottom = ref(true)

async function handleScroll(useDelay = true) {
  if (useDelay) {
    await ncDelay(400)
  }

  const el = fieldConfigRef.value
  if (!el) return

  // Check if scrolled to the bottom
  const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight

  if (isAtBottom) {
    isScrolledToBottom.value = true
  } else if (isScrolledToBottom.value) {
    isScrolledToBottom.value = false
  }
}

function handleFieldSelect(fieldConfig: BulkUpdateFieldConfig, columnId: string) {
  fieldConfig.columnId = columnId
  if (!fieldConfig.opType) {
    fieldConfig.opType = BulkUpdateFieldActionOpTypes.SET_VALUE
  }
  fieldConfig.uidt = meta?.value?.columnsById?.[columnId]?.uidt
  fieldConfig.value = null
}

function handleFieldUpdateTypeSelect(fieldConfig: BulkUpdateFieldConfig, opType: BulkUpdateFieldActionOpTypes) {
  fieldConfig.opType = opType

  if (fieldConfig.uidt === UITypes.Checkbox && opType === BulkUpdateFieldActionOpTypes.SET_VALUE) {
    fieldConfig.value = true
  } else {
    fieldConfig.value = null
  }

  handleAutoScrollField(fieldConfig.id)
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

          if (column.uidt !== UITypes.Checkbox && !requiredFieldValidatorFn(value)) {
            return false
          }

          if (column.uidt === UITypes.Rating && (!value || Number(value) < 1)) {
            return false
          }

          return true
        }),
        numberInputValidator: helpers.withMessage('Please enter a number', (value, _currentConfig) => {
          const currentConfig = _currentConfig as BulkUpdateFieldConfig

          if (![UITypes.Number, UITypes.Currency, UITypes.Percent].includes(currentConfig.uidt)) return true

          if (
            value &&
            value !== '-' &&
            !(currentConfig.uidt === UITypes.Number ? /^-?\d+$/.test(value) : /^-?\d*\.?\d+$/.test(value))
          ) {
            return false
          }

          return true
        }),
        urlValidator: helpers.withMessage('Invalid URL', (value, _currentConfig) => {
          const currentConfig = _currentConfig as BulkUpdateFieldConfig

          if (currentConfig.uidt !== UITypes.URL || !value || isValidURL(value)) return true

          return false
        }),
        phoneNumberValidator: helpers.withMessage('Invalid phone number', (value, _currentConfig) => {
          const currentConfig = _currentConfig as BulkUpdateFieldConfig

          if (currentConfig.uidt !== UITypes.PhoneNumber || !value || isMobilePhone(value)) return true

          return false
        }),
        emailValidator: helpers.withMessage('Invalid Email', (value, _currentConfig) => {
          const currentConfig = _currentConfig as BulkUpdateFieldConfig

          if (currentConfig.uidt !== UITypes.Email || !value || validateEmail(value)) return true

          return false
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
    $e(`a:extension:${EXTENSION_ID}:bulk-update`)
    reloadData()
    isUpdating.value = false
    isOpenConfigModal.value = false
    fullscreen.value = false
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

  await bulkUpdateView(data)
}

const handleConfirmUpdate = async () => {
  await validateAll()

  if (v$.value.$error) {
    return
  }

  await loadViewData()
}

onClickOutside(formRef, (e) => {
  if (!fullscreen.value || (e.target as HTMLElement)?.closest(`.nc-bulk-update-add-action-section, .nc-select-dropdown`)) return
  if ((e.target as HTMLElement) === fieldConfigRef.value?.children?.[0]) {
    fieldConfigExpansionPanel.value = []

    handleScroll()
  }

  validateAll()
})

watch(
  [() => fullscreen.value, () => bulkUpdatePayload.value?.viewId],
  ([isFullscreen]) => {
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

const focusInput = async (initQuery: string) => {
  await ncDelay(300)

  if (!formRef.value?.$el) return

  const inputEl =
    (formRef.value?.$el.querySelector(`${initQuery} .nc-cell input`) as HTMLInputElement) ||
    (formRef.value?.$el.querySelector(`${initQuery} .nc-cell textarea`) as HTMLTextAreaElement) ||
    (formRef.value?.$el.querySelector(`${initQuery} .nc-cell [contenteditable="true"]`) as HTMLElement) ||
    (formRef.value?.$el.querySelector(`${initQuery} .nc-cell [tabindex="0"]`) as HTMLElement)

  if (inputEl) {
    inputEl?.select?.()
    inputEl?.focus?.()
  }
}

const handleOpenDropdown = async (query: string, eventName: 'mousedown' | 'click' = 'mousedown') => {
  await ncDelay(300)

  const el = formRef.value?.$el?.querySelector(query)

  if (!el) return

  el.dispatchEvent(new Event(eventName))
}

watch(
  () => fieldConfigExpansionPanel.value,
  (value) => {
    if (!value.length) return

    const activeField = bulkUpdatePayload.value?.config.find((config) => config.id === value[0])

    if (!activeField) return

    if (!activeField.columnId) {
      handleOpenDropdown(`.nc-bulk-update-field-confit-${activeField.id} .nc-field-select-input .ant-select-selector`)
    } else if (!activeField.opType) {
      handleOpenDropdown(`.nc-bulk-update-field-confit-${activeField.id} .nc-field-update-type-select-input .ant-select-selector`)
    } else if (activeField.opType === BulkUpdateFieldActionOpTypes.SET_VALUE && !activeField.value) {
      if ([UITypes.SingleSelect, UITypes.MultiSelect, UITypes.User].includes(activeField.uidt)) {
        handleOpenDropdown(`.nc-bulk-update-field-confit-${activeField.id} .nc-data-cell .nc-input .ant-select-selector`, 'click')
      } else {
        focusInput(`.nc-bulk-update-field-confit-${activeField.id}`)
      }
    }
  },
)

eventBus.on((event) => {
  if (event === SmartsheetStoreEvents.FIELD_RELOAD && bulkUpdatePayload.value?.tableId === activeTableId.value) {
    updateColumns()
  }
})

const { row } = useProvideSmartsheetRowStore(
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
      class="bulk-update-ee h-full flex flex-col"
      :class="{
        'gap-6 bg-nc-bg-gray-extralight': fullscreen,
      }"
    >
      <div v-if="!fullscreen" class="p-3 flex">
        <div
          class="nc-bulk-update-select-wrapper flex-1 flex items-center border-1 border-nc-border-gray-medium rounded-lg relative shadow-default max-w-full"
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
      </div>
      <div class="bulk-update-body h-full flex-1 flex flex-col">
        <div v-if="!fullscreen" class="bulk-update-header">Actions</div>
        <div
          class="flex-1 flex"
          :class="{
            'h-full': fullscreen,
            'nc-scrollbar-thin': !fullscreen,
          }"
        >
          <div
            v-if="fullscreen"
            class="w-[320px] border-r-1 border-r-nc-border-gray-medium bg-white p-4 pt-t flex flex-col gap-5"
          >
            <div class="text-base font-bold text-nc-content-gray-extreme">Settings</div>
            <div class="flex flex-col gap-2">
              <div class="text-nc-content-gray font-medium">Table</div>
              <a-form-item class="!my-0">
                <NcSelect
                  v-model:value="savedPayloads.selectedTableId"
                  placeholder="-select table-"
                  :disabled="isExporting"
                  class="nc-bulk-update-table-select-sidebar nc-select-shadow"
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
            </div>
            <div class="flex flex-col gap-2">
              <div class="text-nc-content-gray font-medium">View</div>
              <a-form-item class="!my-0 min-w-1/2">
                <NcSelect
                  v-model:value="savedPayloads.selectedViewId"
                  placeholder="-select view-"
                  :disabled="isExporting"
                  class="nc-bulk-update-view-select-sidebar nc-select-shadow"
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
          </div>
          <div
            ref="fieldConfigRef"
            class="nc-field-config-ref h-full flex-1 flex flex-col"
            :class="{
              'pt-5 px-4 relative nc-scrollbar-thin': fullscreen,
              'max-h-[calc(100%_-_25px)]': !fullscreen,
            }"
            @scroll="handleScroll(false)"
          >
            <div class="flex-1 flex flex-col gap-6 w-full">
              <template v-if="fullscreen">
                <div
                  v-if="showNoRecordToUpdateInlineToast"
                  class="w-full max-w-[520px] mx-auto p-4 flex items-start gap-4 bg-white border-1 border-nc-border-gray-medium rounded-lg"
                >
                  <GeneralIcon icon="alertTriangleSolid" class="text-nc-content-orange-medium h-6 w-6 flex-none" />
                  <div class="flex flex-col gap-1">
                    <div class="text-nc-content-gray text-sm font-bold">No Records to Update</div>
                    <div class="text-nc-content-gray-muted text-sm">
                      No values will be updated as there are 0 records in Table name/View name.
                    </div>
                  </div>
                  <NcButton size="xs" type="text" icon-only @click="showNoRecordToUpdateInlineToast = false">
                    <template #icon>
                      <GeneralIcon icon="close" class="text-gray-600" />
                    </template>
                  </NcButton>
                </div>
                <div v-else class="flex items-center gap-3 w-full max-w-[520px] mx-auto">
                  <div class="text-nc-content-gray-subtle2">
                    {{ selectedFieldConfigForBulkUpdate.length }} fields set for bulk update
                  </div>
                </div>
              </template>

              <a-form
                ref="formRef"
                no-style
                name="column-create-or-edit"
                layout="vertical"
                class=""
                :class="{
                  'border-1 border-nc-border-gray-medium rounded-2xl bg-white w-full max-w-[520px] !mx-auto ': fullscreen,
                  'flex-1 flex ': !fullscreen,
                }"
              >
                <a-collapse
                  v-if="bulkUpdatePayload?.config?.length"
                  v-model:active-key="fieldConfigExpansionPanel"
                  class="nc-bulk-update-field-config-section flex flex-col w-full"
                >
                  <template #expandIcon> </template>
                  <a-collapse-panel
                    v-for="fieldConfig in bulkUpdatePayload?.config"
                    :key="fieldConfig.id"
                    collapsible="disabled"
                    :class="`nc-bulk-update-field-confit-${fieldConfig.id}`"
                  >
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

                        <div v-else class="flex-1 flex text-nc-content-gray w-[calc(100%_-_32px)]">
                          <div class="flex items-center gap-3 w-full">
                            <NcCheckbox v-model:checked="fieldConfig.selected" @click.stop />
                            <div class="flex items-center gap-1 w-[calc(100%_-_36px)]">
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

                              <div
                                v-if="fieldConfig.opType === BulkUpdateFieldActionOpTypes.SET_VALUE && !!fieldConfig.value"
                                class="flex truncate"
                              >
                                "
                                <NcTooltip class="truncate" show-on-truncate-only>
                                  <template #title>
                                    <LazySmartsheetPlainCell
                                      v-model="fieldConfig.value"
                                      :column="meta?.columnsById?.[fieldConfig.columnId]"
                                      class="field-config-plain-cell-value"
                                    />
                                  </template>

                                  <LazySmartsheetPlainCell
                                    v-model="fieldConfig.value"
                                    :column="meta?.columnsById?.[fieldConfig.columnId]"
                                    class="field-config-plain-cell-value"
                                  />
                                </NcTooltip>
                                "
                              </div>
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
                          show-search
                          :filter-option="filterOption"
                          class="nc-field-select-input w-full nc-select-shadow"
                          placeholder="-select a field-"
                          @update:value="(value) => handleFieldSelect(fieldConfig, value)"
                          @change="saveChanges()"
                        >
                          <a-select-option
                            v-for="col of bulkUpdateColumns"
                            :key="col.title"
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
                          show-search
                          :disabled="!fieldConfig.columnId"
                          :filter-option="filterOption"
                          class="nc-field-update-type-select-input w-full nc-select-shadow"
                          placeholder="-select an update type-"
                          @update:value="(value) => handleFieldUpdateTypeSelect(fieldConfig, value)"
                          @change="saveChanges()"
                        >
                          <a-select-option v-for="action of fieldActionOptions" :key="action.label" :value="action.value">
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
                          fieldConfig.opType === BulkUpdateFieldActionOpTypes.SET_VALUE &&
                          fieldConfig.uidt !== UITypes.Checkbox
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
                          :key="meta?.columnsById?.[fieldConfig.columnId]?.uidt"
                          class="relative min-h-8"
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

                      <div class="w-full flex justify-end">
                        <NcButton
                          type="text"
                          size="xs"
                          class="flex-none"
                          icon-position="right"
                          @click="handleRemoveFieldConfig(fieldConfig.id)"
                        >
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
                  <NcButton v-if="!fullscreen" size="small" :disabled="isAllFieldSelected" @click="addNewAction">
                    <template #icon>
                      <GeneralIcon icon="ncPlus" />
                    </template>
                    Add fields to update
                  </NcButton>
                </div>
              </a-form>
              <div v-if="bulkUpdatePayload?.config?.length && fullscreen" class="-mt-2"></div>

              <div
                v-if="fullscreen"
                class="nc-bulk-update-add-action-section sticky bottom-0 py-2 px-4 bg-nc-bg-gray-extralight -mt-6 -mx-4 flex items-center"
                :class="{
                  'border-t-1 border-nc-border-gray-medium': !isScrolledToBottom,
                }"
              >
                <NcTooltip :disabled="!isAllFieldSelected" title="No more fields to add" class="w-full max-w-[520px] !mx-auto">
                  <NcButton type="secondary" size="medium" class="w-full" :disabled="isAllFieldSelected" @click="addNewAction">
                    <template #icon>
                      <GeneralIcon icon="ncPlus" />
                    </template>
                    New Action
                  </NcButton>
                </NcTooltip>
              </div>
            </div>
          </div>
        </div>
        <div
          v-if="!fullscreen && bulkUpdatePayload?.config?.length"
          class="flex items-center gap-3 justify-end"
          :class="{
            'pt-3': fullscreen,
            'p-3 border-t-1 border-t-nc-border-gray-medium bg-white': !fullscreen,
          }"
        >
          <NcTooltip :disabled="!isAllFieldSelected" title="No more fields to add">
            <NcButton size="small" type="secondary" :disabled="isAllFieldSelected" @click="addNewAction">
              <template #icon>
                <GeneralIcon icon="ncPlus" />
              </template>
              New Action
            </NcButton>
          </NcTooltip>
          <NcButton
            size="small"
            :disabled="v$.$error || !selectedFieldConfigForBulkUpdate.length || isLoadingViewInfo"
            :loading="isLoadingViewInfo"
            @click="handleConfirmUpdate"
          >
            Update Records
          </NcButton>
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
  .nc-bulk-update-table-select-sidebar.ant-select,
  .nc-bulk-update-view-select-sidebar.ant-select {
    .ant-select-selector {
      @apply !rounded-lg;
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
    &.nc-bulk-update-field-config-section .ant-collapse-header {
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
      .nc-bulk-update-field-config-section.ant-collapse {
        @apply !rounded-none;
      }
    }
  }

  .nc-field-select-input {
    .ant-select-selector {
      @apply !rounded-lg;
    }
  }

  .nc-cell {
    &:first-child {
      @apply h-full;
    }
  }
  .nc-cell,
  .nc-virtual-cell {
    @apply bg-white dark:bg-slate-500 appearance-none;

    &.nc-cell-checkbox {
      @apply color-transition !border-0;

      .nc-icon {
        @apply !text-2xl;
      }

      .nc-cell-hover-show {
        opacity: 100 !important;

        div {
          background-color: transparent !important;
        }
      }
    }

    &:not(.nc-cell-checkbox) {
      &.nc-input {
        @apply w-full h-8;

        &:not(.layout-list) {
          & > div {
            @apply !bg-transparent;
          }
        }

        .duration-cell-wrapper {
          @apply w-full h-full;

          input {
            @apply !outline-none h-full;

            &::placeholder {
              @apply text-gray-400 dark:text-slate-300;
            }
          }
        }

        &.nc-cell-percent {
          & > div,
          input {
            @apply h-full;
          }
        }

        &.nc-cell-phonenumber,
        &.nc-cell-email {
          input {
            @apply h-full;
          }
        }

        &.nc-cell-datetime {
          .nc-cell-field {
            @apply h-full;
          }
        }

        &:not(.readonly) {
          &:not(.nc-cell-longtext) {
            input,
            textarea,
            &.nc-virtual-cell {
              @apply bg-white !disabled:bg-transparent;
            }
          }
          &.nc-cell-longtext {
            textarea {
              @apply bg-white !disabled:bg-transparent;
            }
          }
        }

        input,
        textarea,
        &.nc-virtual-cell {
          .ant-btn {
            @apply dark:(bg-slate-300);
          }

          .chip {
            @apply dark:(bg-slate-700 text-white);
          }
        }

        &.layout-list > div {
          .ant-btn {
            @apply dark:(bg-slate-300);
          }

          .chip {
            @apply dark:(bg-slate-700 text-white);
          }
        }

        &.nc-cell-longtext {
          @apply p-0 h-auto;
          & > div {
            @apply w-full;
          }
          &.readonly > div {
            @apply px-3 py-1;
          }

          textarea {
            @apply px-3;
          }
        }
        &.nc-cell:not(.nc-cell-longtext) {
          @apply px-2 py-1;

          &.nc-cell-phonenumber,
          &.nc-cell-email,
          &.nc-cell-url {
            .nc-cell-field.nc-cell-link-preview {
              @apply !px-3;
            }
          }
        }
        &.nc-virtual-cell {
          @apply px-2 py-1;
        }

        &.nc-cell-json {
          @apply !h-auto;

          & > div {
            @apply w-full;
          }
        }

        .ant-picker,
        input.nc-cell-field {
          @apply !py-0 !px-1;
        }

        .ant-picker-input {
          @apply h-full;
        }

        &.nc-cell-currency {
          @apply !py-0 !pl-0 flex items-stretch;

          .nc-currency-code {
            @apply !bg-gray-100;
          }
        }
        &.nc-cell-attachment {
          @apply h-auto;
        }
      }
    }

    .nc-attachment-cell > div {
      @apply dark:(bg-slate-100);
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

  &.nc-readonly-div-data-cell:focus-within,
  &.nc-system-field:focus-within {
    @apply !border-gray-200;
  }

  &:focus-within:not(.nc-readonly-div-data-cell):not(.nc-system-field) {
    @apply !shadow-selected !border-1 !border-brand-500;
  }
}

:deep(.nc-system-field input) {
  @apply bg-transparent;
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
