<script setup lang="ts">
import { useColumnCreateStoreOrThrow, useVModel } from '#imports'
import {ModelTypes} from "nocodb-sdk";

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const { t } = useI18n()

const vModel = useVModel(props, 'value', emit)

const { validateInfos, setAdditionalValidations, onDataTypeChange } = useColumnCreateStoreOrThrow()

const baseStore = useBase()
const { tables } = storeToRefs(baseStore)

setAdditionalValidations({
  'custom.colId': [
    {
      validator: (_, value: string) => {
        return new Promise((resolve, reject) => {
          if (value?.length > 59) {
            return reject(t('msg.length59Required'))
          }
          resolve(true)
        })
      },
    },
  ],
  'custom.refTableId': [
    {
      validator: (_, value: string) => {
        return new Promise((resolve, reject) => {
          if (value?.length > 59) {
            return reject(t('msg.length59Required'))
          }
          resolve(true)
        })
      },
    },
  ],
  'custom.refColId': [
    {
      validator: (_, value: string) => {
        return new Promise((resolve, reject) => {
          if (value?.length > 59) {
            return reject(t('msg.length59Required'))
          }
          resolve(true)
        })
      },
    },
  ],
  'custom.juncTableId': [
    {
      validator: (_, value: string) => {
        return new Promise((resolve, reject) => {
          if (value?.length > 59) {
            return reject(t('msg.length59Required'))
          }
          resolve(true)
        })
      },
    },
  ],
  'custom.juncColId': [
    {
      validator: (_, value: string) => {
        return new Promise((resolve, reject) => {
          if (value?.length > 59) {
            return reject(t('msg.length59Required'))
          }
          resolve(true)
        })
      },
    },
  ],
  'custom.juncRefColId': [
    {
      validator: (_, value: string) => {
        return new Promise((resolve, reject) => {
          if (value?.length > 59) {
            return reject(t('msg.length59Required'))
          }
          resolve(true)
        })
      },
    },
  ],
})

// set default value
vModel.value.custom = {

}

const refTables = computed(() =>{

  if (!tables.value || !tables.value.length) {
    return []
  }

  return tables.value.filter((t) => t.type === ModelTypes.TABLE && t.source_id === meta.value?.source_id)
})


const columns = $computed(() => {
  if (!tables || !tables.length) {
    return []
  }

  return meta.value?.columns;
})

const refTableColumns = $computed(() => {
  if (!vModel.value.custom?.refTableId) {
    return []
  }

  return tables.find(table => table.id === vModel.value.custom?.refTableId)?.columns;
})

const juncTableColumns = $computed(() => {
  if (!vModel.value.custom?.juncTableId) {
    return []
  }

  return tables.find(table => table.id === vModel.value.custom?.juncTableId)?.columns;
})



const filterOption = (value: string, option: { key: string }) => option.key.toLowerCase().includes(value.toLowerCase())
</script>

<template>
  <div>
    <div class="flex flex-row space-x-2">
      <a-form-item
        class="flex w-full pb-2 mt-4 nc-ltar-child-table"
        :label="$t('labels.childTable')"
        v-bind="validateInfos.childId"
      >
        <a-select
          v-model:value="vModel.custom.refTableId"
          show-search
          :filter-option="filterOption"
          dropdown-class-name="nc-dropdown-ltar-child-table"
          @change="onDataTypeChange"
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
        </a-select>
      </a-form-item>
    </div>
  </div>
</template>
