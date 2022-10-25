<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'
import type { SelectProps } from 'ant-design-vue'
import { useVModel } from '#imports'

const props = defineProps<{
  value: any
}>()
const emit = defineEmits(['update:value'])

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const reloadDataHook = inject(ReloadViewDataHookInj)!

const { fields, metaColumnById } = useViewColumns(activeView, meta, () => reloadDataHook.trigger())

const vModel = useVModel(props, 'value', emit)

const { column } = useColumnCreateStoreOrThrow()

const allowedColumnTypesForQrValue = [UITypes.Formula, UITypes.SingleLineText, UITypes.LongText] as string[]

const columnsAllowedAsQrValue = computed<SelectProps['options']>(() => {
  return fields.value
    ?.filter((el) => el.fk_column_id && allowedColumnTypesForQrValue.includes(metaColumnById.value[el.fk_column_id].uidt))
    .map((field) => {
      return {
        value: field.fk_column_id,
        label: field.title,
      }
    })
})

// set default value
vModel.value.fk_qr_value_column_id = (column?.value?.colOptions as Record<string, any>)?.fk_qr_value_column_id || ''
</script>

<template>
  <a-row>
    <a-col :span="24">
      <div>
        <span class="font-bold"> {{ $t('labels.chooseQrValueColumn') }}</span>
        <a-divider class="!my-2" />
      </div>
      <div class="nc-fields-list py-1">
        <div class="grouping-field">
          <a-select
            v-model:value="vModel.fk_qr_value_column_id"
            class="w-full nc-kanban-grouping-field-select"
            :options="columnsAllowedAsQrValue"
            placeholder="Select a Grouping Field"
            @click.stop
          />
        </div>
      </div>
    </a-col>
  </a-row>
</template>
