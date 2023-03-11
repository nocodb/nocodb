<script setup lang="ts">
import { ModelTypes, MssqlUi, SqliteUi } from 'nocodb-sdk'
import { MetaInj, inject, ref, storeToRefs, useProject, useVModel } from '#imports'
import MdiPlusIcon from '~icons/mdi/plus-circle-outline'
import MdiMinusIcon from '~icons/mdi/minus-circle-outline'
import {storeToRefs} from "pinia";

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const { appInfo } = $(useGlobal())

const vModel = useVModel(props, 'value', emit)

const meta = $(inject(MetaInj, ref()))

const { setAdditionalValidations, validateInfos, onDataTypeChange, sqlUi } = useColumnCreateStoreOrThrow()

const { tables } = $(storeToRefs(useProject()))

setAdditionalValidations({
  childId: [{ required: true, message: 'Required' }],
})

const onUpdateDeleteOptions = sqlUi === MssqlUi ? ['NO ACTION'] : ['NO ACTION', 'CASCADE', 'RESTRICT', 'SET NULL', 'SET DEFAULT']

if (!vModel.value.parentId) vModel.value.parentId = meta?.id
if (!vModel.value.childId) vModel.value.childId = null
if (!vModel.value.childColumn) vModel.value.childColumn = `${meta?.table_name}_id`
if (!vModel.value.childTable) vModel.value.childTable = meta?.table_name
if (!vModel.value.parentTable) vModel.value.parentTable = vModel.value.rtn || ''
if (!vModel.value.parentColumn) vModel.value.parentColumn = vModel.value.rcn || ''

if (!vModel.value.type) vModel.value.type = 'mm'
if (!vModel.value.onUpdate) vModel.value.onUpdate = onUpdateDeleteOptions[0]
if (!vModel.value.onDelete) vModel.value.onDelete = onUpdateDeleteOptions[0]
if (!vModel.value.virtual) vModel.value.virtual = appInfo.isCloud || sqlUi === SqliteUi
if (!vModel.value.alias) vModel.value.alias = vModel.value.column_name

const advancedOptions = $(ref(false))

const refTables = $computed(() => {
  if (!tables || !tables.length) {
    return []
  }

  return tables.filter((t) => t.type === ModelTypes.TABLE && t.base_id === meta?.base_id)
})

const filterOption = (value: string, option: { key: string }) => option.key.toLowerCase().includes(value.toLowerCase())
</script>

<template>
  <div class="w-full flex flex-col mb-2 mt-4">
    <div class="border-2 p-6">
      <a-form-item v-bind="validateInfos.type" class="nc-ltar-relation-type">
        <a-radio-group v-model:value="vModel.type" name="type" v-bind="validateInfos.type">
          <a-radio value="hm" :disabled="appInfo.isCloud">Has Many</a-radio>
          <a-radio value="mm">Many To Many</a-radio>
        </a-radio-group>
      </a-form-item>

      <a-form-item
        class="flex w-full pb-2 mt-4 nc-ltar-child-table"
        :label="$t('labels.childTable')"
        v-bind="validateInfos.childId"
      >
        <a-select
          v-model:value="vModel.childId"
          show-search
          :filter-option="filterOption"
          dropdown-class-name="nc-dropdown-ltar-child-table"
          @change="onDataTypeChange"
        >
          <a-select-option v-for="table of refTables" :key="table.title" :value="table.id">
            <div class="flex items-center gap-2">
              <div class="min-w-5 flex items-center justify-center">
                <GeneralTableIcon :meta="table" class="text-gray-500"></GeneralTableIcon>
              </div>

              <span class="overflow-ellipsis min-w-0 shrink-1">{{ table.title }}</span>
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
    </div>

    <div
      class="text-xs cursor-pointer text-grey nc-more-options my-2 flex items-center gap-1 justify-end"
      @click="advancedOptions = !advancedOptions"
    >
      {{ advancedOptions ? $t('general.hideAll') : $t('general.showMore') }}

      <component :is="advancedOptions ? MdiMinusIcon : MdiPlusIcon" />
    </div>

    <div v-if="advancedOptions" class="flex flex-col p-6 gap-4 border-2 mt-2">
      <div class="flex flex-row space-x-2">
        <a-form-item class="flex w-1/2" :label="$t('labels.onUpdate')">
          <a-select
            v-model:value="vModel.onUpdate"
            :disabled="vModel.virtual"
            name="onUpdate"
            dropdown-class-name="nc-dropdown-on-update"
            @change="onDataTypeChange"
          >
            <a-select-option v-for="(option, i) of onUpdateDeleteOptions" :key="i" :value="option">
              {{ option }}
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item class="flex w-1/2" :label="$t('labels.onDelete')">
          <a-select
            v-model:value="vModel.onDelete"
            :disabled="vModel.virtual"
            name="onDelete"
            dropdown-class-name="nc-dropdown-on-delete"
            @change="onDataTypeChange"
          >
            <a-select-option v-for="(option, i) of onUpdateDeleteOptions" :key="i" :value="option">
              {{ option }}
            </a-select-option>
          </a-select>
        </a-form-item>
      </div>

      <div class="flex flex-row">
        <a-form-item>
          <a-checkbox v-model:checked="vModel.virtual" :disabled="appInfo.isCloud" name="virtual" @change="onDataTypeChange"
            >Virtual Relation</a-checkbox
          >
        </a-form-item>
      </div>
    </div>
  </div>
</template>
