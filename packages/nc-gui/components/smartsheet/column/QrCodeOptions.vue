<script setup lang="ts">
import type { ColumnType, UITypes } from 'nocodb-sdk'
import { AllowedColumnTypesForQrAndBarcodes, isVirtualCol } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: any
}>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const { fields, metaColumnById } = useViewColumnsOrThrow()

const vModel = useVModel(props, 'modelValue', emit)

const { setAdditionalValidations, validateInfos, column, isEdit } = useColumnCreateStoreOrThrow()

const columnsAllowedAsQrValue = computed<ColumnType[]>(() => {
  return (
    fields.value
      ?.filter(
        (el) =>
          el.fk_column_id && AllowedColumnTypesForQrAndBarcodes.includes(metaColumnById.value[el.fk_column_id].uidt as UITypes),
      )
      .map((field) => {
        return metaColumnById.value[field.fk_column_id!]
      }) || []
  )
})

onMounted(() => {
  // set default value
  vModel.value.fk_qr_value_column_id =
    (column?.value?.colOptions as Record<string, any>)?.fk_qr_value_column_id ||
    (!isEdit.value ? columnsAllowedAsQrValue.value?.[0]?.id : null)
})

setAdditionalValidations({
  fk_qr_value_column_id: [{ required: true, message: t('general.required') }],
})

const cellIcon = (column: ColumnType) =>
  h(isVirtualCol(column) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: column,
  })
</script>

<template>
  <div class="flex flex-col gap-2">
    <a-form-item
      class="flex nc-qr-code-value-column-select"
      :label="`${$t('placeholder.value')} ${t('objects.field').toLowerCase()}`"
      v-bind="validateInfos.fk_qr_value_column_id"
    >
      <a-select
        v-model:value="vModel.fk_qr_value_column_id"
        :placeholder="$t('placeholder.selectAColumnForTheQRCodeValue')"
        @click.stop
      >
        <template #suffixIcon>
          <GeneralIcon icon="arrowDown" class="text-gray-700" />
        </template>

        <a-select-option v-for="(option, index) of columnsAllowedAsQrValue" :key="index" :value="option.id">
          <div class="flex gap-2 w-full truncate items-center" :data-testid="`nc-qr-${option.title}`">
            <div class="inline-flex items-center gap-2 flex-1 truncate">
              <component :is="cellIcon(option)" :column-meta="option" class="!mx-0 flex-none w-4 h-4" />
              <NcTooltip show-on-truncate-only class="flex-1 truncate">
                <template #title>{{ option.title }}</template>
                {{ option.title }}
              </NcTooltip>
            </div>

            <component
              :is="iconMap.check"
              v-if="vModel.fk_qr_value_column_id === option.id"
              id="nc-selected-item-icon"
              class="text-primary w-4 h-4"
            />
          </div>
        </a-select-option>
      </a-select>
    </a-form-item>
  </div>
</template>
