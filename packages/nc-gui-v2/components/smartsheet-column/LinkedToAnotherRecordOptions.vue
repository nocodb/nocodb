<script setup lang="ts">
import { ModelTypes, MssqlUi, SqliteUi } from 'nocodb-sdk'
import { inject, useColumnCreateStoreOrThrow, useProject } from '#imports'
import { MetaInj } from '~/context'
import MdiPlusIcon from '~icons/mdi/plus-circle-outline'
import MdiMinusIcon from '~icons/mdi/minus-circle-outline'

const { formState, validateInfos, onDataTypeChange, setAdditionalValidations } = $(useColumnCreateStoreOrThrow())
const { tables, sqlUi } = $(useProject())
const meta = $(inject(MetaInj)!)

setAdditionalValidations({
  childId: [{ required: true, message: 'Required' }],
})

const onUpdateDeleteOptions = sqlUi === MssqlUi ? ['NO ACTION'] : ['NO ACTION', 'CASCADE', 'RESTRICT', 'SET NULL', 'SET DEFAULT']

if (!formState.parentId) formState.parentId = meta.id
if (!formState.childId) formState.childId = null
if (!formState.childColumn) formState.childColumn = `${meta.table_name}_id`
if (!formState.childTable) formState.childTable = meta.table_name
if (!formState.parentTable) formState.parentTable = formState.rtn || ''
if (!formState.parentColumn) formState.parentColumn = formState.rcn || ''

if (!formState.type) formState.type = 'hm'
if (!formState.onUpdate) formState.onUpdate = onUpdateDeleteOptions[0]
if (!formState.onDelete) formState.onDelete = onUpdateDeleteOptions[0]
if (!formState.virtual) formState.virtual = sqlUi === SqliteUi
if (!formState.alias) formState.alias = formState.column_name

const advancedOptions = $(ref(false))

const refTables = $computed(() => {
  if (!tables || !tables.length) {
    return []
  }

  return tables.filter((t) => t.type === ModelTypes.TABLE)
})
</script>

<template>
  <div class="w-full flex flex-col mb-2 mt-4">
    <div class="border-2 p-6">
      <a-form-item v-bind="validateInfos.type">
        <a-radio-group v-model:value="formState.type" name="type" v-bind="validateInfos.type">
          <a-radio value="hm">Has Many</a-radio>
          <a-radio value="mm">Many To Many</a-radio>
        </a-radio-group>
      </a-form-item>
      <a-form-item class="flex w-full pb-2 mt-4" :label="$t('labels.childTable')" v-bind="validateInfos.childId">
        <a-select v-model:value="formState.childId" @change="onDataTypeChange">
          <a-select-option v-for="(table, index) in refTables" :key="index" :value="table.id">
            {{ table.title }}
          </a-select-option>
        </a-select>
      </a-form-item>
    </div>

    <div
      class="text-xs cursor-pointer text-grey nc-more-options my-2 flex align-center gap-1 justify-end"
      @click="advancedOptions = !advancedOptions"
    >
      {{ advancedOptions ? $t('general.hideAll') : $t('general.showMore') }}
      <component :is="advancedOptions ? MdiMinusIcon : MdiPlusIcon" />
    </div>

    <div v-if="advancedOptions" class="flex flex-col p-6 gap-4 border-2 mt-2">
      <div class="flex flex-row space-x-2">
        <a-form-item class="flex w-1/2" :label="$t('labels.onUpdate')">
          <a-select v-model:value="formState.onUpdate" :disabled="formState.virtual" name="onUpdate" @change="onDataTypeChange">
            <a-select-option v-for="(option, index) in onUpdateDeleteOptions" :key="index" :value="option">
              {{ option }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item class="flex w-1/2" :label="$t('labels.onDelete')">
          <a-select v-model:value="formState.onDelete" :disabled="formState.virtual" name="onDelete" @change="onDataTypeChange">
            <a-select-option v-for="(option, index) in onUpdateDeleteOptions" :key="index" :value="option">
              {{ option }}
            </a-select-option>
          </a-select>
        </a-form-item>
      </div>
      <div class="flex flex-row">
        <a-form-item>
          <a-checkbox v-model:checked="formState.virtual" name="virtual" @change="onDataTypeChange">Virtual Relation</a-checkbox>
        </a-form-item>
      </div>
    </div>
  </div>
</template>
