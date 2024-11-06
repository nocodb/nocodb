<script setup lang="ts">
import dayjs from 'dayjs'
import { required, helpers, maxLength } from '@vuelidate/validators'
import useVuelidate from '@vuelidate/core'

import {
  type ColumnType,
  type ViewType,
  ViewTypes,
  UITypes,
  getSystemColumnsIds,
  type TableType,
  getSystemColumns,
  isVirtualCol,
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

const { $api, $poller } = useNuxtApp()

const { appInfo } = useGlobal()

const router = useRouter()
const route = router.currentRoute

const activeTableId = computed(() => route.value.params.viewId as string | undefined)

const activeViewTitleOrId = computed(() => {
  return route.value.params.viewTitle
})

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
  op_type?: BulkUpdateFieldActionOpTypes
  value?: any
}

enum BulkUpdateFieldActionOpTypes {
  CLEAR_VALUE = 'CLEAR_VALUE',
  SET_VALUE = 'SET_VALUE',
}

const bulkUpdatePayloadPlaceholder: BulkUpdatePayloadType = {
  selectedTableId: '',
  selectedViewId: '',
  history: [],
}

const bulkUpdateFieldConfigPlaceholder: BulkUpdateFieldConfig = {
  id: '',
  columnId: '',
  op_type: '',
  value: null,
}

const { extension, tables, fullscreen, getViewsForTable, getTableMeta } = useExtensionHelperOrThrow()

const { jobList, loadJobsForBase } = useJobs()

const views = ref<ViewType[]>([])

const deletedExports = ref<string[]>([])

const bulkUpdateRef = ref<HTMLDivElement>()

const { width } = useElementSize(bulkUpdateRef)

const meta = ref<TableType>()

const systemFieldsIds = computed(() => getSystemColumnsIds(meta.value?.columns || []))

const bulkUpdateColumns = computed(() => {
  return (meta.value?.columns || []).filter((c) => {
    return !hiddenColTypes.includes(c.uidt) && !systemFieldsIds.value.includes(c.id)
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

async function onTableSelect(tableId?: string) {
  if (!tableId) {
    savedPayloads.value.selectedTableId = activeTableId.value
    await reloadViews()
    savedPayloads.value.selectedViewId = activeViewTitleOrId.value
      ? views.value.find((view) => view.id === activeViewTitleOrId.value)?.id
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
  if (fieldConfigExpansionPanel.value.includes(key)) {
    fieldConfigExpansionPanel.value = []
  } else {
    fieldConfigExpansionPanel.value = [key]
  }
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

  handleUpdateFieldConfigExpansionPanel(configId)
  validateAll()
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

const rules = computed(() => {
  return (bulkUpdatePayload.value?.config || []).reduce((acc, config) => {
    if (!config?.id) return acc

    acc[config.id] = {
      columnId: {
        required,
      },
      op_type: {
        required,
      },
      // value: {
      //   required,
      // },
    }

    return acc
  }, {})
})

// Use Vuelidate to create validation instance
const v$ = useVuelidate(rules, fieldConfigMap)

async function validateAll() {
  await v$.value?.$validate()
}

watch(
  fullscreen,
  (newValue) => {
    if (newValue) {
      if (!bulkUpdatePayload.value?.config?.length) {
        addNewAction()
      }
    }
  },
  {
    immediate: true,
  },
)

onMounted(async () => {
  await loadJobsForBase()
})

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
      <NcButton size="small" :disabled="v$.$error">Update Records</NcButton>
    </template>

    <div
      ref="bulkUpdateRef"
      class="bulk-update-ee h-full flex flex-col"
      :class="{
        'py-6 px-4  gap-6 bg-nc-bg-gray-extralight': fullscreen,
      }"
    >
      <template v-if="!fullscreen">
        <div class="p-3 flex">
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
          <div class="bulk-update-header">Actions</div>
          <div
            v-if="bulkUpdatePayload && bulkUpdatePayload.config?.length"
            class="flex-1 flex flex-col nc-scrollbar-thin max-h-[calc(100%_-_25px)]"
          ></div>
          <div v-else class="px-3 py-4 min-h-[120px] flex-1 flex flex-col gap-3 items-center justify-center text-gray-600">
            <div>No fields set</div>
            <NcButton size="small">
              <template #icon>
                <GeneralIcon icon="ncPlus" />
              </template>
              Add fields to update
            </NcButton>
          </div>
        </div>
      </template>
      <div v-else class="flex-1 flex flex-col gap-6 w-full max-w-[520px] mx-auto">
        <div class="flex items-center gap-3">
          <NcBadge color="brand" :border="false">23 records</NcBadge>
          <div class="text-nc-content-gray-subtle2">{{ bulkUpdatePayload?.config?.length || 0 }} fields set for bulk update</div>
        </div>

        <a-form
          no-style
          name="column-create-or-edit"
          layout="vertical"
          class="border-1 border-nc-border-gray-medium rounded-2xl bg-white"
        >
          <a-collapse
            v-if="bulkUpdatePayload"
            v-model:active-key="fieldConfigExpansionPanel"
            class="nc-bulk-update-field-config-section flex flex-col"
          >
            <template #expandIcon> </template>
            <a-collapse-panel v-for="fieldConfig in bulkUpdatePayload?.config" :key="fieldConfig.id" collapsible="disabled">
              <template #header>
                <div
                  v-if="!fieldConfigExpansionPanel.includes(fieldConfig.id)"
                  class="w-full flex items-center p-6"
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
                      <NcCheckbox :checked="true" />
                      <div class="flex items-center gap-1">
                        {{ fieldConfig.op_type === BulkUpdateFieldActionOpTypes.CLEAR_VALUE ? 'Clear' : 'Set' }}
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
                          fieldConfig.op_type === BulkUpdateFieldActionOpTypes.CLEAR_VALUE
                            ? ''
                            : fieldConfig.op_type === BulkUpdateFieldActionOpTypes.SET_VALUE
                            ? 'to'
                            : ''
                        }}
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
                <a-form-item class="!my-0 w-full">
                  <template #label>
                    <span>Select field</span>
                  </template>
                  <NcSelect
                    :value="fieldConfig.columnId || undefined"
                    class="nc-field-select-input w-full nc-select-shadow !border-none"
                    placeholder="-select a field-"
                    @update:value="(value) => (fieldConfig.columnId = value)"
                    @change="saveChanges()"
                  >
                    <a-select-option v-for="(col, i) of bulkUpdateColumns" :key="i" :value="col.id">
                      <div class="flex items-center gap-2 w-full">
                        <component :is="getUIDTIcon(UITypes[col.uidt])" class="h-3.5 w-3.5" />

                        <NcTooltip class="truncate flex-1" show-on-truncate-only>
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
                    </a-select-option>
                  </NcSelect>
                </a-form-item>
                <a-form-item class="!my-0 w-full">
                  <template #label>
                    <span>Update type</span>
                  </template>
                  <NcSelect
                    :value="fieldConfig.op_type || undefined"
                    class="nc-field-select-input w-full nc-select-shadow !border-none"
                    placeholder="-select a field-"
                    @update:value="(value) => (fieldConfig.op_type = value)"
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
                          v-if="fieldConfig.op_type === action.value"
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
                    fieldConfig.op_type === BulkUpdateFieldActionOpTypes.SET_VALUE
                  "
                  class="!my-0 w-full"
                >
                  <LazySmartsheetDivDataCell class="relative min-h-8" @click.stop>
                    <LazySmartsheetVirtualCell
                      v-if="isVirtualCol(meta?.columnsById?.[fieldConfig.columnId]?.uidt)"
                      v-model="fieldConfig.value"
                      class="nc-input"
                      :column="meta.columnsById[fieldConfig.columnId]"
                    />
                    <LazySmartsheetCell
                      v-else
                      v-model="fieldConfig.value"
                      class="nc-input truncate"
                      :column="meta.columnsById[fieldConfig.columnId]"
                      :edit-enabled="true"
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
        </a-form>

        <div class="nc-bulk-update-add-action-section">
          <NcButton type="secondary" size="medium" class="w-full" @click="addNewAction">
            <template #icon>
              <GeneralIcon icon="ncPlus" />
            </template>
            New action
          </NcButton>
        </div>
      </div>
    </div>
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
}
</style>

<style lang="scss" scoped>
:deep(.ant-select-selector) {
  @apply !xs:(h-full);
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
</style>
