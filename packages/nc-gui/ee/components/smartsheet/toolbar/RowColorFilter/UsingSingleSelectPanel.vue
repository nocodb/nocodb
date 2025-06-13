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
  <div class="w-[420px] p-4 flex flex-col gap-4">
    <a-form-item class="!my-0">
      <NcSelect
        v-model:value="vModel.fk_column_id"
        class="nc-colouring-field-select w-full nc-select-shadow"
        :dropdown-match-select-width="false"
        @change="emits('change', vModel)"
      >
        <a-select-option v-for="(column, idx) of columns" :key="idx" :value="column.id">
          <div class="w-full flex gap-2 items-center">
            <SmartsheetHeaderIcon :column="column" class="!mx-0" />
            <NcTooltip class="flex-1 truncate" show-on-truncate-only>
              <template #title>
                {{ column.title }}
              </template>
              {{ column.title }}
            </NcTooltip>
            <component
              :is="iconMap.check"
              v-if="vModel.fk_column_id === column.id"
              id="nc-selected-item-icon"
              class="text-primary w-4 h-4"
            />
          </div>
        </a-select-option>
      </NcSelect>
    </a-form-item>

    <div class="flex items-center gap-2 justify-between">
      <NcButton type="text" size="small" @click="emits('remove')">
        {{ $t('labels.removeColouring') }}
      </NcButton>

      <div class="flex items-center cursor-pointer select-none text-nc-content-gray">
        <NcSwitch v-model:checked="vModel.is_set_as_background" placement="right" @change="emits('change', vModel)">
          {{ $t('labels.backgroundColour') }}
        </NcSwitch>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-colouring-field-select.nc-select.ant-select) {
  .ant-select-selector {
    @apply !rounded-lg;
  }
}
</style>
