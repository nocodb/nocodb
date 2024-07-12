<script setup lang="ts">
import {
  useColumnCreateStoreOrThrow,
  useVModel,
  computed,
  inject,
  MetaInj,
  ref,
  useI18n,
  useBase,
  useBases,
  storeToRefs,
  useMetas,
} from '#imports'
import {
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isVirtualCol,
  ModelTypes,
  RelationTypes,
  type TableType,
} from 'nocodb-sdk'
import { useTable } from '../../../composables/useTable'
import { useTablesStore } from '../../../store/tables'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const { t } = useI18n()

const meta = inject(MetaInj, ref({} as TableType))

const vModel = useVModel(props, 'value', emit)

const { validateInfos, setAdditionalValidations, onDataTypeChange } = useColumnCreateStoreOrThrow()

// const baseStore = useBase()
// const { base } = storeToRefs(baseStore)

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
}

console.log('meta', meta.value, vModel.value)
const { basesList, bases } = storeToRefs(useBases())
const tablesStore = useTablesStore()
const { baseTables, activeTable, activeTables: sourceTables } = storeToRefs(tablesStore)

const sourceColumn = computed(() => {
  return meta?.value?.columns?.find((f) => vModel.value.custom?.column_id === f.id)
})

/*const refTables = computed(() =>{

  if (!tables.value || !tables.value.length) {
    return []
  }

  return tables.value.filter((t) => t.type === ModelTypes.TABLE && t.source_id === meta.value?.source_id)
})*/

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

const columns = computed(() => {
  if (!meta.value?.columns) {
    return []
  }

  return meta.value.columns?.filter(
    (c) => !isCreatedOrLastModifiedByCol(c) && !isCreatedOrLastModifiedTimeCol(c) && !isVirtualCol(c),
  )
})

const refTableColumns = computed(() => {
  if (!vModel.value.custom?.ref_model_id || !metas.value[vModel.value.custom?.ref_model_id]) {
    return []
  }

  return metas.value[vModel.value.custom?.ref_model_id]?.columns?.filter(
    (c) => !isCreatedOrLastModifiedByCol(c) && !isCreatedOrLastModifiedTimeCol(c) && !isVirtualCol(c),
  )
})

const juncTableColumns = computed(() => {
  if (!vModel.value.custom?.junc_model_id || !metas.value[vModel.value.custom?.junc_model_id]) {
    return []
  }

  return metas.value[vModel.value.custom?.junc_model_id]?.columns?.filter(
    (c) => !isCreatedOrLastModifiedByCol(c) && !isCreatedOrLastModifiedTimeCol(c) && !isVirtualCol(c),
  )
})

const filterOption = (value: string, option: { key: string }) => option.key.toLowerCase().includes(value.toLowerCase())

const resetSelectedColumns = (isJunction: boolean = false) => {
  if (isJunction) {
    if (vModel.value.custom.junc_column_id) {
      vModel.value.custom.junc_column_id = null
    }
    if (vModel.value.custom.junc_ref_column_id) {
      vModel.value.custom.junc_ref_column_id = null
    }
  } else {
    if (vModel.value.custom.ref_column_id) {
      vModel.value.custom.ref_column_id = null
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

watch(pkColumn, () => {
  if (pkColumn.value?.id && !vModel.value.custom?.column_id) {
    vModel.value.custom = {
      ...vModel.value.custom,
      column_id: pkColumn.value.id,
    }
  }
})
</script>

<template>
  <div v-if="validateInfos">
    <div class="mb-2">Relation Settings</div>
    <div class="flex items-start gap-3">
      <div class="nc-relation-settings-table flex flex-col">
        <div class="nc-relation-settings-table-header">Source</div>

        <a-form-item class="nc-relation-settings-table-row disabled nc-ltar-source-base" v-bind="validateInfos['custom.base_id']">
          <a-select
            :value="meta.base_id"
            show-search
            :filter-option="filterOption"
            disabled
            :bordered="false"
            dropdown-class-name="nc-dropdown-ltar-source-base"
          >
            <a-select-option v-for="base of basesList" :key="base.title" :value="base.id">
              <div class="flex w-full items-center gap-2">
                <div class="min-w-5 flex items-center justify-center">
                  <!-- <GeneralTableIcon :meta="base" class="text-gray-500" /> -->
                  <GeneralProjectIcon :color="parseProp(base.meta).iconColor" />
                </div>
                <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                  <template #title>{{ base.title }}</template>
                  <span>{{ base.title }}</span>
                </NcTooltip>
              </div>
            </a-select-option>
            <template #suffixIcon>
              <GeneralIcon class="" icon="chevronDown" />
            </template>
          </a-select>
        </a-form-item>

        <a-form-item
          class="nc-relation-settings-table-row disabled nc-ltar-source-table"
          v-bind="validateInfos['custom.base_id']"
        >
          <a-select
            :value="activeTable?.id"
            show-search
            :filter-option="filterOption"
            disabled
            :bordered="false"
            dropdown-class-name="nc-dropdown-ltar-source-table"
          >
            <a-select-option v-for="table of sourceTables" :key="table.title" :value="table.id">
              <div class="flex w-full items-center gap-2">
                <div class="min-w-5 flex items-center justify-center">
                  <GeneralTableIcon :meta="table" class="text-gray-500" />
                </div>
                <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                  <template #title>{{ table.title }}</template>
                  <span>{{ table.title }}</span>
                </NcTooltip>
              </div>
            </a-select-option>
            <template #suffixIcon>
              <GeneralIcon class="" icon="chevronDown" />
            </template>
          </a-select>
        </a-form-item>
        <a-form-item class="nc-relation-settings-table-row nc-ltar-source-column" v-bind="validateInfos['custom.column_id']">
          <a-select
            v-model:value="vModel.custom.column_id"
            show-search
            placeholder="-select field-"
            :filter-option="filterOption"
            :bordered="false"
            dropdown-class-name="nc-dropdown-ltar-source-column !text-xs"
            @change="onDataTypeChange"
          >
            <a-select-option v-for="column of columns" :key="column.title" :value="column.id">
              <div class="flex w-full items-center gap-2">
                <div class="min-w-5 flex items-center justify-center">
                  <SmartsheetHeaderVirtualCellIcon
                    v-if="isVirtualCol(column)"
                    :column-meta="column"
                  ></SmartsheetHeaderVirtualCellIcon>
                  <SmartsheetHeaderCellIcon v-else :column-meta="column"></SmartsheetHeaderCellIcon>
                </div>
                <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                  <template #title>{{ column.title }}</template>
                  <span>{{ column.title }}</span>
                </NcTooltip>
              </div>
            </a-select-option>
            <template #suffixIcon>
              <GeneralIcon class="" icon="chevronDown" />
            </template>
          </a-select>
          <div class="nc-relation-settings-table-connector-point nc-right" :class="`column-type-${vModel.type}`"></div>
        </a-form-item>
      </div>

      <template v-if="isMm">
        <div class="nc-relation-settings-table flex flex-col">
          <div class="nc-relation-settings-table-header">Junction</div>
          <a-form-item class="nc-relation-settings-table-row nc-ltar-junction-base" v-bind="validateInfos['custom.junc_base_id']">
            <a-select
              v-model:value="vModel.custom.junc_base_id"
              show-search
              :filter-option="filterOption"
              :bordered="false"
              dropdown-class-name="nc-dropdown-ltar-junction-base"
              @change="onBaseChange(vModel.custom.junc_base_id, true)"
            >
              <a-select-option v-for="base of basesList" :key="base.title" :value="base.id">
                <div class="flex w-full items-center gap-2">
                  <div class="min-w-5 flex items-center justify-center">
                    <GeneralProjectIcon :color="parseProp(base.meta).iconColor" />
                  </div>
                  <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                    <template #title>{{ base.title }}</template>
                    <span>{{ base.title }}</span>
                  </NcTooltip>
                </div>
              </a-select-option>
              <template #suffixIcon>
                <GeneralIcon class="" icon="chevronDown" />
              </template>
            </a-select>
          </a-form-item>
          <a-form-item
            class="nc-relation-settings-table-row nc-ltar-junction-table"
            v-bind="validateInfos['custom.junc_model_id']"
          >
            <a-select
              v-model:value="vModel.custom.junc_model_id"
              show-search
              placeholder="-select table-"
              :bordered="false"
              :filter-option="filterOption"
              dropdown-class-name="nc-dropdown-ltar-junction-table"
              @change="onModelIdChange(vModel.custom.junc_model_id, true)"
            >
              <a-select-option v-for="table of junctionTables" :key="table.title" :value="table.id">
                <div class="flex w-full items-center gap-2">
                  <div class="min-w-5 flex items-center justify-center">
                    <GeneralTableIcon :meta="table" class="text-gray-500" />
                  </div>
                  <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                    <template #title>{{ table.title }}</template>
                    <span>{{ table.title }}</span>
                  </NcTooltip>
                </div>
              </a-select-option>
              <template #suffixIcon>
                <GeneralIcon class="" icon="chevronDown" />
              </template>
            </a-select>
          </a-form-item>

          <a-form-item
            class="nc-relation-settings-table-row nc-ltar-source-junction-column"
            v-bind="validateInfos['custom.junc_column_id']"
          >
            <a-select
              v-model:value="vModel.custom.junc_column_id"
              show-search
              placeholder="-select field-"
              :bordered="false"
              :filter-option="filterOption"
              dropdown-class-name="nc-dropdown-ltar-source-junction-column"
              @change="onDataTypeChange"
            >
              <a-select-option v-for="column of juncTableColumns" :key="column.title" :value="column.id">
                <div class="flex w-full items-center gap-2">
                  <div class="min-w-5 flex items-center justify-center">
                    <SmartsheetHeaderVirtualCellIcon
                      v-if="isVirtualCol(column)"
                      :column-meta="column"
                    ></SmartsheetHeaderVirtualCellIcon>
                    <SmartsheetHeaderCellIcon v-else :column-meta="column"></SmartsheetHeaderCellIcon>
                  </div>
                  <NcTooltip class="flex-1 truncate" :show-on-truncate-only="sourceColumn?.dt === column.dt">
                    <template #title>{{
                      sourceColumn?.dt === column.dt ? column.title : `Incompatible with column '${sourceColumn?.title}'`
                    }}</template>
                    <span>{{ column.title }}</span>
                  </NcTooltip>
                </div>
              </a-select-option>
              <template #suffixIcon>
                <GeneralIcon class="" icon="chevronDown" />
              </template>
            </a-select>
            <div class="nc-relation-settings-table-connector-point nc-left" :class="`column-type-${vModel.type}`"></div>
          </a-form-item>

          <a-form-item
            class="nc-relation-settings-table-row nc-ltar-child-junction-column"
            v-bind="validateInfos['custom.junc_ref_column_id']"
          >
            <a-select
              v-model:value="vModel.custom.junc_ref_column_id"
              show-search
              placeholder="-select field-"
              :bordered="false"
              :filter-option="filterOption"
              dropdown-class-name="nc-dropdown-ltar-child-junction-column"
              @change="onDataTypeChange"
            >
              <a-select-option v-for="column of juncTableColumns" :key="column.title" :value="column.id">
                <div class="flex w-full items-center gap-2">
                  <div class="min-w-5 flex items-center justify-center">
                    <SmartsheetHeaderVirtualCellIcon
                      v-if="isVirtualCol(column)"
                      :column-meta="column"
                    ></SmartsheetHeaderVirtualCellIcon>
                    <SmartsheetHeaderCellIcon v-else :column-meta="column"></SmartsheetHeaderCellIcon>
                  </div>
                  <NcTooltip class="flex-1 truncate" :show-on-truncate-only="sourceColumn?.dt === column.dt">
                    <template #title>{{
                      sourceColumn?.dt === column.dt ? column.title : `Incompatible with column '${sourceColumn?.title}'`
                    }}</template>
                    <span>{{ column.title }}</span>
                  </NcTooltip>
                </div>
              </a-select-option>
              <template #suffixIcon>
                <GeneralIcon class="" icon="chevronDown" />
              </template>
            </a-select>
            <div class="nc-relation-settings-table-connector-point nc-right" :class="`column-type-${vModel.type}`"></div>
          </a-form-item>
        </div>
      </template>
      <div class="nc-relation-settings-table flex flex-col">
        <div class="nc-relation-settings-table-header">Child</div>

        <a-form-item class="nc-relation-settings-table-row nc-ltar-child-base" v-bind="validateInfos['custom.base_id']">
          <a-select
            v-model:value="vModel.custom.base_id"
            show-search
            :filter-option="filterOption"
            :bordered="false"
            dropdown-class-name="nc-dropdown-ltar-child-base"
            @change="onBaseChange(vModel.custom.base_id)"
          >
            <a-select-option v-for="base of basesList" :key="base.title" :value="base.id">
              <div class="flex w-full items-center gap-2">
                <div class="min-w-5 flex items-center justify-center">
                  <GeneralProjectIcon :color="parseProp(base.meta).iconColor" />
                </div>
                <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                  <template #title>{{ base.title }}</template>
                  <span>{{ base.title }}</span>
                </NcTooltip>
              </div>
            </a-select-option>
            <template #suffixIcon>
              <GeneralIcon class="" icon="chevronDown" />
            </template>
          </a-select>
        </a-form-item>

        <a-form-item class="nc-relation-settings-table-row nc-ltar-child-table" v-bind="validateInfos['custom.ref_model_id']">
          <a-select
            v-model:value="vModel.custom.ref_model_id"
            show-search
            placeholder="-select table-"
            :filter-option="filterOption"
            :bordered="false"
            dropdown-class-name="nc-dropdown-ltar-child-table"
            @change="onModelIdChange(vModel.custom.ref_model_id)"
          >
            <a-select-option v-for="table of refTables" :key="table.title" :value="table.id">
              <div class="flex w-full items-center gap-2">
                <div class="min-w-5 flex items-center justify-center">
                  <GeneralTableIcon :meta="table" class="text-gray-500" />
                </div>
                <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                  <template #title>{{ table.title }}</template>
                  <span>{{ table.title }}</span>
                </NcTooltip>
              </div>
            </a-select-option>
            <template #suffixIcon>
              <GeneralIcon class="" icon="chevronDown" />
            </template>
          </a-select>
        </a-form-item>
        <a-form-item class="nc-relation-settings-table-row nc-ltar-child-column" v-bind="validateInfos['custom.ref_column_id']">
          <a-select
            v-model:value="vModel.custom.ref_column_id"
            show-search
            placeholder="-select field-"
            :filter-option="filterOption"
            :bordered="false"
            dropdown-class-name="nc-dropdown-ltar-child-column !text-xs"
            @change="onDataTypeChange"
          >
            <a-select-option
              v-for="column of refTableColumns"
              :key="column.title"
              :value="column.id"
              :disabled="sourceColumn?.dt !== column.dt"
            >
              <div class="flex w-full items-center gap-2">
                <div class="min-w-5 flex items-center justify-center">
                  <SmartsheetHeaderVirtualCellIcon
                    v-if="isVirtualCol(column)"
                    :column-meta="column"
                  ></SmartsheetHeaderVirtualCellIcon>
                  <SmartsheetHeaderCellIcon v-else :column-meta="column"></SmartsheetHeaderCellIcon>
                </div>
                <NcTooltip class="flex-1 truncate" :show-on-truncate-only="sourceColumn?.dt === column.dt">
                  <template #title>{{
                    sourceColumn?.dt === column.dt ? column.title : `Incompatible with column '${sourceColumn?.title}'`
                  }}</template>
                  <span>{{ column.title }}</span>
                </NcTooltip>
              </div>
            </a-select-option>
            <template #suffixIcon>
              <GeneralIcon class="" icon="chevronDown" />
            </template>
          </a-select>
          <div class="nc-relation-settings-table-connector-point nc-left" :class="`column-type-${vModel.type}`"></div>
        </a-form-item>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-relation-settings-table {
  @apply min-w-[180px] w-[180px] flex flex-col border-1 border-gray-200 rounded-lg;

  .nc-relation-settings-table-header {
    @apply px-3 py-2 flex items-center space-x-3 bg-gray-100 text-xs font-semibold border-b border-gray-200;
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
        @apply pl-2;
      }
    }
    :deep(.ant-select-arrow) {
      @apply mr-2;
    }

    .nc-relation-settings-table-connector-point {
      @apply absolute top-[50%] rounded-full w-2 h-2;
      transform: translateY(-50%);

      &.nc-right {
        @apply -right-1;
      }

      &.nc-left {
        @apply -left-1;
      }
    }
    .column-type-mm {
      @apply bg-pink-500;
    }
    .column-type-hm {
      @apply bg-orange-500;
    }
    .column-type-oo {
      @apply bg-purple-500;
    }
  }
}
</style>
