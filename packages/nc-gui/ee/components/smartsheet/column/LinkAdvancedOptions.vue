<script setup lang="ts">
import {
  type ColumnType,
  ModelTypes,
  RelationTypes,
  type TableType,
  UITypes,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isVirtualCol,
} from 'nocodb-sdk'
import { computed, storeToRefs, useBase, useColumnCreateStoreOrThrow, useMetas, useTablesStore, useVModel } from '#imports'

const props = defineProps<{
  value: any
  meta: TableType
  isEdit: boolean
}>()

const emit = defineEmits(['update:value'])

const meta = toRef(props, 'meta')

const vModel = useVModel(props, 'value', emit)

const { validateInfos, onDataTypeChange } = useColumnCreateStoreOrThrow()

const { metas, getMeta } = useMetas()

const isMm = computed(() => vModel.value.type === RelationTypes.MANY_TO_MANY)

const pkColumn = computed(() => {
  return meta?.value?.columns?.find((f) => f.pk)
})

// set default value
vModel.value.custom = {
  base_id: meta.value?.base_id,
  column_id: pkColumn.value?.id,
  junc_base_id: meta.value?.base_id,
  ...(vModel.value?.custom || {}),
}

const tablesStore = useTablesStore()
const { baseTables, activeTable, activeTables: sourceTables } = storeToRefs(tablesStore)

const sourceColumn = computed(() => {
  return meta?.value?.columns?.find((f) => vModel.value.custom?.column_id === f.id)
})

/* const refTables = computed(() =>{

  if (!tables.value || !tables.value.length) {
    return []
  }

  return tables.value.filter((t) => t.type === ModelTypes.TABLE && t.source_id === meta.value?.source_id)
}) */

const refTables = computed(() => {
  if (!baseTables.value.get(vModel.value.custom.base_id)) {
    return []
  }

  return [...baseTables.value.get(vModel.value.custom.base_id).filter((t) => t.type === ModelTypes.TABLE)]
})

const junctionTables = computed(() => {
  if (!baseTables.value.get(vModel.value.custom.junc_base_id)) {
    return []
  }

  return [...baseTables.value.get(vModel.value.custom.junc_base_id).filter((t) => t.type === ModelTypes.TABLE)]
})

function filterSupportedColumns(columns: ColumnType[]) {
  return columns?.filter(
    (c) =>
      !isCreatedOrLastModifiedByCol(c) &&
      !isCreatedOrLastModifiedTimeCol(c) &&
      !isVirtualCol(c) &&
      ![UITypes.Attachment, UITypes.MultiSelect, UITypes.JSON].includes(c.uidt) &&
      !c.system,
  )
}

const columns = computed(() => {
  if (!meta.value?.columns) {
    return []
  }
  return filterSupportedColumns(meta.value.columns)
})

const refTableColumns = computed(() => {
  if (!vModel.value.custom?.ref_model_id || !metas.value[vModel.value.custom?.ref_model_id]) {
    return []
  }

  return filterSupportedColumns(metas.value[vModel.value.custom?.ref_model_id]?.columns)
})

const juncTableColumns = computed(() => {
  if (!vModel.value.custom?.junc_model_id || !metas.value[vModel.value.custom?.junc_model_id]) {
    return []
  }

  return filterSupportedColumns(metas.value[vModel.value.custom?.junc_model_id]?.columns)
})

const filterOption = (value: string, option: { key: string }) => option.key.toLowerCase().includes(value.toLowerCase())

const resetSelectedColumns = (isJunction: boolean = false, resetOnChangeDataType: boolean = false) => {
  if (isJunction) {
    if (vModel.value.custom.junc_column_id) {
      if (resetOnChangeDataType) {
        if (sourceColumn.value?.dt !== juncTableColumns.value.find((c) => c.id === vModel.value.custom.junc_column_id)?.dt) {
          vModel.value.custom.junc_column_id = null
        }
      } else {
        vModel.value.custom.junc_column_id = null
      }
    }

    if (vModel.value.custom.junc_ref_column_id) {
      if (resetOnChangeDataType) {
        if (sourceColumn.value?.dt !== juncTableColumns.value.find((c) => c.id === vModel.value.custom.junc_ref_column_id)?.dt) {
          vModel.value.custom.junc_ref_column_id = null
        }
      } else {
        vModel.value.custom.junc_ref_column_id = null
      }
    }
  } else {
    if (vModel.value.custom.ref_column_id) {
      if (resetOnChangeDataType) {
        if (sourceColumn.value?.dt !== refTableColumns.value.find((c) => c.id === vModel.value.custom.ref_column_id)?.dt) {
          vModel.value.custom.ref_column_id = null
        }
      } else {
        vModel.value.custom.ref_column_id = null
      }
    }
  }
}
const onModelIdChange = async (modelId: string, isJunctionModel: boolean = false) => {
  // todo: optimise
  await getMeta(modelId, false, false, vModel.value.custom.base_id)
  await getMeta(modelId)
  await onDataTypeChange()
  resetSelectedColumns(isJunctionModel)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const onBaseChange = async (baseId, isJunctionBase: boolean = false) => {
  await tablesStore.loadProjectTables(baseId)

  if (isJunctionBase) {
    if (vModel.value.custom.junc_model_id) {
      vModel.value.custom.junc_model_id = null
    }
    resetSelectedColumns(true)
  } else {
    if (vModel.value.custom.ref_model_id) {
      vModel.value.custom.ref_model_id = null
    }
    resetSelectedColumns(false)
  }
}

const onSourceColumnChange = async () => {
  await onDataTypeChange()
  resetSelectedColumns(true, true)
  resetSelectedColumns(false, true)
}
/*
const getBaseIconColor = (base, selectedBaseId) => {
  if (base.id === selectedBaseId) {
    return undefined
  } else {
    return parseProp(base.meta).iconColor
  }
} */
watch(pkColumn, () => {
  if (pkColumn.value?.id && !vModel.value.custom?.column_id) {
    vModel.value.custom = {
      ...vModel.value.custom,
      column_id: pkColumn.value.id,
    }
  }
})

const { sqlUis } = storeToRefs(useBase())

const sqlUi = computed(() => (meta.value?.source_id ? sqlUis.value[meta.value?.source_id] : Object.values(sqlUis.value)[0]))

onMounted(async () => {
  if (vModel.value?.custom?.junc_model_id) {
    await getMeta(vModel.value.custom.junc_model_id)
  }
  if (vModel.value?.custom?.ref_model_id) {
    await getMeta(vModel.value.custom.ref_model_id)
  }
})
</script>

<template>
  <div v-if="validateInfos">
    <div class="mb-2">Relation Settings</div>
    <div class="flex items-start gap-3">
      <div class="nc-relation-settings-table flex flex-col">
        <div class="nc-relation-settings-table-header">Source</div>

        <!--
       Disabled inter-base link at the moment
          <a-form-item class="nc-relation-settings-table-row disabled nc-ltar-source-base">
          <NcSelect
            suffix-icon="chevronDown"
            :value="meta.base_id"
            show-search
            :filter-option="filterOption"
            disabled
            :bordered="false"
            dropdown-class-name="nc-relation-settings-select nc-dropdown-ltar-source-base"
            data-testid="custom-link-source-base-id"
          >
            <a-select-option v-for="base of basesList" :key="base.title" :value="base.id">
              <div class="flex w-full items-center gap-2">
                <div class="flex items-center justify-center">
                  <GeneralProjectIcon class="nc-project-icon" />
                </div>
                <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                  <template #title>{{ base.title }}</template>
                  <span>{{ base.title }}</span>
                </NcTooltip>
              </div>
            </a-select-option>
          </NcSelect>
        </a-form-item> -->

        <a-form-item class="nc-relation-settings-table-row disabled nc-ltar-source-table">
          <NcSelect
            suffix-icon="chevronDown"
            :value="activeTable?.id"
            show-search
            :filter-option="filterOption"
            disabled
            :bordered="false"
            dropdown-class-name="nc-relation-settings-select nc-dropdown-ltar-source-table"
            data-testid="custom-link-source-table-id"
          >
            <a-select-option v-for="table of sourceTables" :key="table.title" :value="table.id">
              <div class="flex w-full items-center gap-2">
                <div class="flex items-center justify-center">
                  <GeneralTableIcon :meta="table" class="nc-table-icon" />
                </div>
                <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                  <template #title>{{ table.title }}</template>
                  <span>{{ table.title }}</span>
                </NcTooltip>
              </div>
            </a-select-option>
          </NcSelect>
        </a-form-item>
        <a-form-item class="nc-relation-settings-table-row nc-ltar-source-column" v-bind="validateInfos['custom.column_id']">
          <NcSelect
            v-model:value="vModel.custom.column_id"
            :disabled="isEdit"
            suffix-icon="chevronDown"
            show-search
            placeholder="-select field-"
            :filter-option="filterOption"
            :bordered="false"
            dropdown-class-name="nc-relation-settings-select nc-dropdown-ltar-source-column"
            data-testid="custom-link-source-column-id"
            @change="onSourceColumnChange"
          >
            <a-select-option v-for="column of columns" :key="column.title" :value="column.id">
              <div class="flex w-full items-center gap-2">
                <div class="flex items-center justify-center">
                  <SmartsheetHeaderVirtualCellIcon
                    v-if="isVirtualCol(column)"
                    :column-meta="column"
                    class="nc-cell-icon"
                  ></SmartsheetHeaderVirtualCellIcon>
                  <SmartsheetHeaderCellIcon v-else :column-meta="column" class="nc-cell-icon"></SmartsheetHeaderCellIcon>
                </div>
                <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                  <template #title>{{ column.title }}</template>
                  <span>{{ column.title }}</span>
                </NcTooltip>
              </div>
            </a-select-option>
          </NcSelect>
          <div
            class="nc-relation-settings-table-connector-point nc-relation-settings-table-connector-line nc-right nc-source"
            :class="`column-type-${vModel.type}`"
          ></div>
        </a-form-item>
      </div>

      <template v-if="isMm">
        <div class="nc-relation-settings-table flex flex-col">
          <div class="nc-relation-settings-table-header">Junction</div>
          <!--
       Disabled inter-base link at the moment
       <a-form-item class="nc-relation-settings-table-row nc-ltar-junction-base">
            <NcSelect
              v-model:value="vModel.custom.junc_base_id"
              suffix-icon="chevronDown"
              show-search
              :filter-option="filterOption"
              :bordered="false"
              dropdown-class-name="nc-relation-settings-select nc-dropdown-ltar-junction-base !rounded-md"
              data-testid="custom-link-junction-base-id"
              @change="onBaseChange(vModel.custom.junc_base_id, true)"
            >
              <a-select-option v-for="base of basesList" :key="base.title" :value="base.id">
                <div class="flex w-full items-center gap-2">
                  <div class="flex items-center justify-center">
                    <GeneralProjectIcon :color="getBaseIconColor(base, vModel.custom.junc_base_id)" class="nc-project-icon" />
                  </div>
                  <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                    <template #title>{{ base.title }}</template>
                    <span>{{ base.title }}</span>
                  </NcTooltip>
                </div>
              </a-select-option>
            </NcSelect>
          </a-form-item> -->
          <a-form-item
            class="nc-relation-settings-table-row nc-ltar-junction-table"
            v-bind="validateInfos['custom.junc_model_id']"
          >
            <NcSelect
              v-model:value="vModel.custom.junc_model_id"
              :disabled="isEdit"
              suffix-icon="chevronDown"
              show-search
              placeholder="-select table-"
              :bordered="false"
              :filter-option="filterOption"
              dropdown-class-name="nc-relation-settings-select nc-dropdown-ltar-junction-table"
              data-testid="custom-link-junction-table-id"
              @change="onModelIdChange(vModel.custom.junc_model_id, true)"
            >
              <a-select-option v-for="table of junctionTables" :key="table.title" :value="table.id">
                <div class="flex w-full items-center gap-2">
                  <div class="flex items-center justify-center">
                    <GeneralTableIcon :meta="table" class="nc-table-icon" />
                  </div>
                  <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                    <template #title>{{ table.title }}</template>
                    <span>{{ table.title }}</span>
                  </NcTooltip>
                </div>
              </a-select-option>
            </NcSelect>
          </a-form-item>

          <a-form-item
            class="nc-relation-settings-table-row nc-ltar-source-junction-column"
            v-bind="validateInfos['custom.junc_column_id']"
          >
            <NcSelect
              v-model:value="vModel.custom.junc_column_id"
              :disabled="isEdit"
              suffix-icon="chevronDown"
              show-search
              placeholder="-select field-"
              :bordered="false"
              :filter-option="filterOption"
              dropdown-class-name="nc-relation-settings-select nc-dropdown-ltar-source-junction-column"
              data-testid="custom-link-junction-source-column-id"
              @change="onDataTypeChange"
            >
              <a-select-option
                v-for="column of juncTableColumns"
                :key="column.title"
                :value="column.id"
                :disabled="!sqlUi.isEqual(sourceColumn?.dt, column.dt) || vModel.custom.column_id === column.id"
              >
                <div class="flex w-full items-center gap-2">
                  <div class="flex items-center justify-center">
                    <SmartsheetHeaderVirtualCellIcon
                      v-if="isVirtualCol(column)"
                      :column-meta="column"
                      class="nc-cell-icon"
                    ></SmartsheetHeaderVirtualCellIcon>
                    <SmartsheetHeaderCellIcon v-else :column-meta="column" class="nc-cell-icon"></SmartsheetHeaderCellIcon>
                  </div>
                  <NcTooltip class="flex-1 truncate" :show-on-truncate-only="sqlUi.isEqual(sourceColumn?.dt, column.dt)">
                    <template #title
                      >{{
                        sqlUi.isEqual(sourceColumn?.dt, column.dt)
                          ? column.title
                          : `Incompatible with column '${sourceColumn?.title}'`
                      }}
                    </template>
                    <span>{{ column.title }}</span>
                  </NcTooltip>
                </div>
              </a-select-option>
            </NcSelect>
            <div
              class="nc-relation-settings-table-connector-point nc-relation-settings-table-connector-line nc-left"
              :class="`column-type-${vModel.type}`"
            ></div>
          </a-form-item>

          <a-form-item
            class="nc-relation-settings-table-row nc-ltar-child-junction-column"
            v-bind="validateInfos['custom.junc_ref_column_id']"
          >
            <NcSelect
              v-model:value="vModel.custom.junc_ref_column_id"
              :disabled="isEdit"
              suffix-icon="chevronDown"
              show-search
              placeholder="-select field-"
              :bordered="false"
              :filter-option="filterOption"
              dropdown-class-name="nc-relation-settings-select nc-dropdown-ltar-child-junction-column"
              data-testid="custom-link-junction-target-column-id"
              @change="onDataTypeChange"
            >
              <a-select-option
                v-for="column of juncTableColumns"
                :key="column.title"
                :value="column.id"
                :disabled="!sqlUi.isEqual(sourceColumn?.dt, column.dt) || vModel.custom.column_id === column.id"
              >
                <div class="flex w-full items-center gap-2">
                  <div class="flex items-center justify-center">
                    <SmartsheetHeaderVirtualCellIcon
                      v-if="isVirtualCol(column)"
                      :column-meta="column"
                      class="nc-cell-icon"
                    ></SmartsheetHeaderVirtualCellIcon>
                    <SmartsheetHeaderCellIcon v-else :column-meta="column" class="nc-cell-icon"></SmartsheetHeaderCellIcon>
                  </div>
                  <NcTooltip class="flex-1 truncate" :show-on-truncate-only="sqlUi.isEqual(sourceColumn?.dt, column.dt)">
                    <template #title
                      >{{
                        !sqlUi.isEqual(sourceColumn?.dt, column.dt)
                          ? column.title
                          : `Incompatible with column '${sourceColumn?.title}'`
                      }}
                    </template>
                    <span>
                      {{ column.title }}
                    </span>
                  </NcTooltip>
                </div>
              </a-select-option>
            </NcSelect>
            <div
              class="nc-relation-settings-table-connector-point nc-relation-settings-table-connector-line nc-right"
              :class="`column-type-${vModel.type}`"
            ></div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="7"
              height="37"
              viewBox="0 0 7 37"
              fill="none"
              class="nc-relation-settings-table-connector-line-junciton-to-child !bg-transparent"
              :class="`column-type-${vModel.type}`"
            >
              <path d="M0 36V36C1.10457 36 2 35.1046 2 34V3C2 1.89543 2.89543 1 4 1H7" stroke="currentColor" />
            </svg>
          </a-form-item>
        </div>
      </template>

      <div class="nc-relation-settings-table flex flex-col">
        <div class="nc-relation-settings-table-header">Child</div>
        <!--
       Disabled inter-base link at the moment
        <a-form-item class="nc-relation-settings-table-row nc-ltar-child-base">
          <NcSelect
            v-model:value="vModel.custom.base_id"
            suffix-icon="chevronDown"
            show-search
            :filter-option="filterOption"
            :bordered="false"
            dropdown-class-name="nc-relation-settings-select nc-dropdown-ltar-child-base"
            data-testid="custom-link-target-base-id"
            @change="onBaseChange(vModel.custom.base_id)"
          >
            <a-select-option v-for="base of basesList" :key="base.title" :value="base.id">
              <div class="flex w-full items-center gap-2">
                <div class="flex items-center justify-center">
                  <GeneralProjectIcon :color="getBaseIconColor(base, vModel.custom.base_id)" class="nc-project-icon" />
                </div>
                <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                  <template #title>{{ base.title }}</template>
                  <span>{{ base.title }}</span>
                </NcTooltip>
              </div>
            </a-select-option>
          </NcSelect>
        </a-form-item> -->

        <a-form-item class="nc-relation-settings-table-row nc-ltar-child-table" v-bind="validateInfos['custom.ref_model_id']">
          <NcSelect
            v-model:value="vModel.custom.ref_model_id"
            :disabled="isEdit"
            suffix-icon="chevronDown"
            show-search
            placeholder="-select table-"
            :filter-option="filterOption"
            :bordered="false"
            dropdown-class-name="nc-relation-settings-select nc-dropdown-ltar-child-table"
            data-testid="custom-link-target-table-id"
            @change="onModelIdChange(vModel.custom.ref_model_id)"
          >
            <a-select-option v-for="table of refTables" :key="table.title" :value="table.id">
              <div class="flex w-full items-center gap-2">
                <div class="flex items-center justify-center">
                  <GeneralTableIcon :meta="table" class="nc-table-icon" />
                </div>
                <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                  <template #title>{{ table.title }}</template>
                  <span>{{ table.title }}</span>
                </NcTooltip>
              </div>
            </a-select-option>
          </NcSelect>
        </a-form-item>
        <a-form-item class="nc-relation-settings-table-row nc-ltar-child-column" v-bind="validateInfos['custom.ref_column_id']">
          <NcSelect
            v-model:value="vModel.custom.ref_column_id"
            :disabled="isEdit"
            suffix-icon="chevronDown"
            show-search
            placeholder="-select field-"
            :filter-option="filterOption"
            :bordered="false"
            dropdown-class-name="nc-relation-settings-select nc-dropdown-ltar-child-column"
            data-testid="custom-link-target-column-id"
            @change="onDataTypeChange"
          >
            <a-select-option
              v-for="column of refTableColumns"
              :key="column.title"
              :value="column.id"
              :disabled="!sqlUi.isEqual(sourceColumn?.dt, column.dt) || vModel.custom.column_id === column.id"
            >
              <div class="flex w-full items-center gap-2">
                <div class="flex items-center justify-center">
                  <SmartsheetHeaderVirtualCellIcon
                    v-if="isVirtualCol(column)"
                    :column-meta="column"
                    class="nc-cell-icon"
                  ></SmartsheetHeaderVirtualCellIcon>
                  <SmartsheetHeaderCellIcon v-else :column-meta="column" class="nc-cell-icon"></SmartsheetHeaderCellIcon>
                </div>
                <NcTooltip class="flex-1 truncate" :show-on-truncate-only="sqlUi.isEqual(sourceColumn?.dt, column.dt)">
                  <template #title
                    >{{
                      sqlUi.isEqual(sourceColumn?.dt, column.dt)
                        ? column.title
                        : `Incompatible with column '${sourceColumn?.title}'`
                    }}
                  </template>
                  <span>{{ column.title }} </span>
                </NcTooltip>
              </div>
            </a-select-option>
          </NcSelect>
          <div
            class="nc-relation-settings-table-connector-point nc-relation-settings-table-connector-line nc-left"
            :class="`column-type-${vModel.type}`"
          ></div>
        </a-form-item>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-relation-settings-table {
  @apply min-w-[180px] w-[180px] flex flex-col border-1 border-gray-200 rounded-lg;

  .nc-relation-settings-table-header {
    @apply px-3 py-2 flex items-center space-x-3 bg-gray-100 text-xs font-semibold border-b border-gray-200 rounded-t-lg;
  }

  .nc-relation-settings-table-row {
    @apply py-[1px] w-full flex items-center space-x-2 !my-0 relative;

    &:not(:last-child) {
      @apply border-b border-gray-200;
    }

    &.disabled {
      @apply bg-gray-50 text-gray-400;
    }

    :deep(.ant-select-selector) {
      @apply px-4 text-xs;

      .ant-select-selection-search-input {
        @apply pl-1;
      }
    }

    :deep(.ant-select-arrow) {
      @apply mr-2;
    }

    :deep(.ant-select-arrow) {
      .nc-select-expand-btn {
        @apply w-3.5 h-3.5;
      }
    }

    .nc-relation-settings-table-connector-point {
      @apply absolute top-[50%] rounded-full w-2 h-2;
      transform: translateY(-50%);

      &.nc-right {
        @apply -right-1;
      }

      &.nc-left {
        @apply -left-[4px];
      }

      &.nc-relation-settings-table-connector-line {
        &.nc-right::after {
          @apply content-[''] block h-[1px] bg-current absolute top-[50%];
          transform: translateY(-50%);
        }

        &.nc-right.nc-source::after {
          @apply w-3 -right-2;
        }
      }
    }

    .nc-relation-settings-table-connector-line-junciton-to-child {
      @apply absolute bottom-[15px] -right-2.8 !text-opacity-90;
    }

    .column-type-mm {
      @apply bg-pink-500 text-pink-500;
    }

    .column-type-hm {
      @apply bg-orange-500 text-orange-500;
    }

    .column-type-oo {
      @apply bg-purple-500 text-purple-500;
    }

    .column-type-bt {
      @apply bg-blue-400 text-blue-400;
    }

    :deep(.ant-form-item-explain) {
      @apply hidden;
    }
  }
}
</style>

<style lang="scss">
.nc-relation-settings-table {
  .nc-project-icon {
    @apply !grayscale flex-none w-3.5 h-3.5;
    filter: grayscale(100%) brightness(115%) !important;
  }

  .nc-table-icon {
    @apply flex-none mx-0 w-3.5 h-3.5;
    path,
    rect {
      stroke: currentColor !important;
    }
  }

  .nc-cell-icon {
    @apply !mx-0 flex-none w-3.5 h-3.5;
  }
}

.nc-relation-settings-select.ant-select-dropdown.nc-select-dropdown {
  @apply !rounded-md max-w-[180px];

  .ant-select-item {
    @apply text-xs;

    .nc-project-icon {
      @apply flex-none w-3.5 h-3.5;
    }

    .nc-table-icon {
      @apply flex-none mx-0 w-3.5 h-3.5;
    }

    .nc-cell-icon {
      @apply !mx-0 flex-none w-3.5 h-3.5;
    }
  }
}
</style>
