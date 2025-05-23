<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'

interface Props {
  modelValue?: Ref<any>
  columns?: ColumnType[]
}

interface Emits {
  (event: 'update:modelValue', model: number): void
  (event: 'remove', model: void): void
}

const props = defineProps({
  modelValue: ref({
    isSetAsBackground: false,
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
      <NcSelect v-model:value="vModel.fk_column_id" class="w-full" :dropdown-match-select-width="false">
        <a-select-option v-for="(column, idx) of columns" :key="idx" :value="column.id">
          {{ column.title }}
        </a-select-option>
      </NcSelect>
      <NcButton size="small" type="text" @click="emits('remove')"><GeneralIcon icon="ncTrash"></GeneralIcon></NcButton>
    </div>
    <div>
      <label class="w-full block cursor-pointer">
        <NcSwitch v-model:checked="vModel.isSetAsBackground"> </NcSwitch>
        <span class="text-nc-content-gray font-semibold flex-1"> Background color </span>
      </label>
    </div>
  </div>
</template>
