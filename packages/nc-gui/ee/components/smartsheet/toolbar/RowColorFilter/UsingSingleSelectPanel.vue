<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import { SmartsheetHeaderIcon } from '#components'

interface Props {
  modelValue?: Ref<any>
  columns?: ColumnType[]
}

interface Emits {
  (
    event: 'update:modelValue',
    model: {
      modelValue?: Ref<any>
      columns?: ColumnType[]
    },
  ): void
  (
    event: 'change',
    model: {
      modelValue?: Ref<any>
      columns?: ColumnType[]
    },
  ): void
  (event: 'remove', model: void): void
}

const props = defineProps({
  modelValue: ref({
    is_set_as_background: false,
    fk_column_id: '',
  }),
  columns: [],
} as Props as any)

const emits = defineEmits<Emits>()
const vModel = useVModel(props, 'modelValue', emits)
</script>

<template>
  <div class="bg-white w-[420px] p-5 rounded-2xl gap-3 flex flex-col">
    <div class="flex items-center gap-2">
      <NcSelect
        v-model:value="vModel.fk_column_id"
        class="w-full"
        :dropdown-match-select-width="false"
        @change="emits('change', vModel)"
      >
        <a-select-option v-for="(column, idx) of columns" :key="idx" :value="column.id">
          <SmartsheetHeaderIcon :column="column" /> {{ column.title }}
        </a-select-option>
      </NcSelect>
      <NcButton size="small" type="text" @click="emits('remove')"><GeneralIcon icon="ncTrash"></GeneralIcon></NcButton>
    </div>
    <div>
      <label class="w-full block cursor-pointer flex content-center items-center gap-2">
        <NcSwitch v-model:checked="vModel.is_set_as_background" @change="emits('change', vModel)"> </NcSwitch>
        <span class="text-nc-content-gray font-semibold flex-1"> Add background color </span>
      </label>
    </div>
  </div>
</template>
