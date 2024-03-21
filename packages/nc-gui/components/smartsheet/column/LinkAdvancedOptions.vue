<script setup lang="ts">
import { useColumnCreateStoreOrThrow, useVModel, computed, inject, MetaInj, ref, useI18n,useBase,
  useBases, storeToRefs, useMetas } from '#imports'
import {
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isVirtualCol,
  ModelTypes,
  RelationTypes,
} from "nocodb-sdk";
import {useTable} from "../../../composables/useTable";
import {useTablesStore} from "../../../store/tables";

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const { t } = useI18n()

const meta = inject(MetaInj, ref())

const vModel = useVModel(props, 'value', emit)

const { validateInfos, setAdditionalValidations, onDataTypeChange } = useColumnCreateStoreOrThrow()

const baseStore = useBase()
// const { tables } = storeToRefs(baseStore)

const { metas, getMeta } = useMetas()


const isMm = computed(() => vModel.value.type === RelationTypes.MANY_TO_MANY)


// set default value
vModel.value.custom = {
  base_id: meta.value?.base_id
}


const { basesList, bases } = storeToRefs(useBases())
const tablesStore = useTablesStore()
const { baseTables } = storeToRefs(tablesStore)

/*const refTables = computed(() =>{

  if (!tables.value || !tables.value.length) {
    return []
  }

  return tables.value.filter((t) => t.type === ModelTypes.TABLE && t.source_id === meta.value?.source_id)
})*/
const refTables = computed(() =>{
  if (!baseTables.value.get(vModel.value.custom.base_id)) {
    return []
  }

  return [...baseTables.value.get(vModel.value.custom.base_id).filter((t) => t.type === ModelTypes.TABLE),
  ...(vModel.value.custom.base_id !== meta.value?.base_id ? baseTables.value.get(meta.value.base_id).filter((t) => t.type === ModelTypes.TABLE) : [])
  ]
})


const columns = computed(() => {
  if (!meta.value?.columns) {
    return []
  }

  return meta.value.columns?.filter(c => !isCreatedOrLastModifiedByCol(c) && !isCreatedOrLastModifiedTimeCol(c) && !isVirtualCol(c));
})

const refTableColumns = computed(() => {
  if (!vModel.value.custom?.ref_model_id || !metas.value[vModel.value.custom?.ref_model_id]) {
    return []
  }


  return metas.value[vModel.value.custom?.ref_model_id]?.columns?.filter(c => !isCreatedOrLastModifiedByCol(c) && !isCreatedOrLastModifiedTimeCol(c) && !isVirtualCol(c))
})

const juncTableColumns = computed(() => {
  if (!vModel.value.custom?.junc_model_id || !metas.value[vModel.value.custom?.junc_model_id]) {
    return []
  }


  return metas.value[vModel.value.custom?.junc_model_id]?.columns?.filter(c => !isCreatedOrLastModifiedByCol(c) && !isCreatedOrLastModifiedTimeCol(c) && !isVirtualCol(c))
})


const filterOption = (value: string, option: { key: string }) => option.key.toLowerCase().includes(value.toLowerCase())


const onModelIdChange =async  (modelId:string) =>{
  // todo: optimise
  await getMeta(modelId, false, false, vModel.value.custom.base_id)
  await getMeta(modelId)
  await onDataTypeChange()
}

const onBaseChange = async (baseId) =>{
  await tablesStore.loadProjectTables(baseId)
  vModel.value.custom.ref_model_id = null
}
</script>

<template>
  <div v-if="validateInfos">
    <div class="flex flex-row space-x-2">

      <a-form-item
          class="flex w-full pb-2 mt-4 nc-ltar-child-table"
          label="Column"
          v-bind="validateInfos['custom.column_id']"
      >
        <a-select
            v-model:value="vModel.custom.column_id"
            show-search
            :filter-option="filterOption"
            dropdown-class-name="nc-dropdown-ltar-child-table"
            @change="onDataTypeChange"
        >
          <a-select-option v-for="column of columns" :key="column.title" :value="column.id">
            <div class="flex w-full items-center gap-2">
              <div class="min-w-5 flex items-center justify-center">
                <GeneralTableIcon :meta="column" class="text-gray-500" />
              </div>
              <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                <template #title>{{ column.title }}</template>
                <span>{{ column.title }}</span>
              </NcTooltip>
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item
        class="flex w-full pb-2 mt-4 nc-ltar-child-table"
        label="Target base"
        v-bind="validateInfos['custom.base_id']"
      >

        <a-select
          v-model:value="vModel.custom.base_id"
          show-search
          :filter-option="filterOption"
          dropdown-class-name="nc-dropdown-ltar-child-table"
          @change="onBaseChange(vModel.custom.base_id)"
        >
          <a-select-option v-for="base of basesList" :key="base.title" :value="base.id">
            <div class="flex w-full items-center gap-2">
              <div class="min-w-5 flex items-center justify-center">
                <GeneralTableIcon :meta="base" class="text-gray-500" />
              </div>
              <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                <template #title>{{ base.title }}</template>
                <span>{{ base.title }}</span>
              </NcTooltip>
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
    </div>
    <div class="flex flex-row space-x-2">
      <a-form-item
        class="flex w-full pb-2 mt-4 nc-ltar-child-table"
        label="Ref table"
        v-bind="validateInfos['custom.ref_model_id']"
      >
        <a-select
          v-model:value="vModel.custom.ref_model_id"
          show-search
          :filter-option="filterOption"
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
                <span>{{ table.title }} <span class="text-8px">({{bases.get(table.base_id)?.title }})</span></span>
              </NcTooltip>
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item
          class="flex w-full pb-2 mt-4 nc-ltar-child-table"
          label="Ref column"
          v-bind="validateInfos['custom.ref_column_id']"
      >
        <a-select
            v-model:value="vModel.custom.ref_column_id"
            show-search
            :filter-option="filterOption"
            dropdown-class-name="nc-dropdown-ltar-child-table"
            @change="onDataTypeChange"
        >
          <a-select-option v-for="column of refTableColumns" :key="column.title" :value="column.id">
            <div class="flex w-full items-center gap-2">
              <div class="min-w-5 flex items-center justify-center">
                <GeneralTableIcon :meta="column" class="text-gray-500" />
              </div>
              <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                <template #title>{{ column.title }}</template>
                <span>{{ column.title }}</span>
              </NcTooltip>
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
    </div>

    <template v-if="isMm">

    <div class="flex flex-row space-x-2">
      <a-form-item
          class="flex w-full pb-2 mt-4 nc-ltar-child-table"
          label="Junction table"
          v-bind="validateInfos['custom.junc_model_id']"
      >
        <a-select
            v-model:value="vModel.custom.junc_model_id"
            show-search
            :filter-option="filterOption"
            dropdown-class-name="nc-dropdown-ltar-child-table"
            @change="onModelIdChange(vModel.custom.junc_model_id)"
        >
          <a-select-option v-for="table of refTables" :key="table.title" :value="table.id">
            <div class="flex w-full items-center gap-2">
              <div class="min-w-5 flex items-center justify-center">
                <GeneralTableIcon :meta="table" class="text-gray-500" />
              </div>
              <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                <template #title>{{ table.title }}</template>
                <span>{{ table.title }} <span class="text-8px">({{bases.get(table.base_id)?.title }})</span></span>
              </NcTooltip>
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
    </div>







    <div class="flex flex-row space-x-2">
      <a-form-item
          class="flex w-full pb-2 mt-4 nc-ltar-child-table"
          label="Column in jn table"
          v-bind="validateInfos['custom.junc_column_id']"
      >
        <a-select
            v-model:value="vModel.custom.junc_column_id"
            show-search
            :filter-option="filterOption"
            dropdown-class-name="nc-dropdown-ltar-child-table"
            @change="onDataTypeChange"
        >
          <a-select-option v-for="column of juncTableColumns" :key="column.title" :value="column.id">
            <div class="flex w-full items-center gap-2">
              <div class="min-w-5 flex items-center justify-center">
                <GeneralTableIcon :meta="column" class="text-gray-500" />
              </div>
              <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                <template #title>{{ column.title }}</template>
                <span>{{ column.title }}</span>
              </NcTooltip>
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item
          class="flex w-full pb-2 mt-4 nc-ltar-child-table"
          label="Ref column in jn table"
          v-bind="validateInfos['custom.junc_ref_column_id']"
      >
        <a-select
            v-model:value="vModel.custom.junc_ref_column_id"
            show-search
            :filter-option="filterOption"
            dropdown-class-name="nc-dropdown-ltar-child-table"
            @change="onDataTypeChange"
        >
          <a-select-option v-for="column of juncTableColumns" :key="column.title" :value="column.id">
            <div class="flex w-full items-center gap-2">
              <div class="min-w-5 flex items-center justify-center">
                <GeneralTableIcon :meta="column" class="text-gray-500" />
              </div>
              <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                <template #title>{{ column.title }}</template>
                <span>{{ column.title }}</span>
              </NcTooltip>
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
    </div>
    </template>
  </div>
</template>
