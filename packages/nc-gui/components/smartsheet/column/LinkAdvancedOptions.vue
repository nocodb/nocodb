<script setup lang="ts">
import { useColumnCreateStoreOrThrow, useVModel, computed, inject, MetaInj, ref, useI18n,useBase, storeToRefs, useMetas } from '#imports'
import {
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isVirtualCol,
  ModelTypes,
  RelationTypes,
  UITypes
} from "nocodb-sdk";
import type {ColumnType} from "nocodb-sdk";

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const { t } = useI18n()

const meta = inject(MetaInj, ref())

const vModel = useVModel(props, 'value', emit)

const { validateInfos, setAdditionalValidations, onDataTypeChange } = useColumnCreateStoreOrThrow()

const baseStore = useBase()
const { tables } = storeToRefs(baseStore)

const { metas, getMeta } = useMetas()


const isMm = computed(() => vModel.value.type === RelationTypes.MANY_TO_MANY)


// set default value
vModel.value.custom = {

}

const refTables = computed(() =>{

  if (!tables.value || !tables.value.length) {
    return []
  }

  return tables.value.filter((t) => t.type === ModelTypes.TABLE && t.source_id === meta.value?.source_id)
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
  await getMeta(modelId)
  await onDataTypeChange()
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
          <a-select-option v-for="table of tables" :key="table.title" :value="table.id">
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
          <a-select-option v-for="table of tables" :key="table.title" :value="table.id">
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
