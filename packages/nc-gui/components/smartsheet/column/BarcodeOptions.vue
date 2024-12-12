<script setup lang="ts">
import { type ColumnType, UITypes } from 'nocodb-sdk'
import { AllowedColumnTypesForQrAndBarcodes, isVirtualCol } from 'nocodb-sdk'
import { supportedBarcodeFormats } from '~/helpers/columnDefaultMeta'

const props = defineProps<{
  modelValue: any
}>()

const emit = defineEmits(['update:modelValue'])

const { fields, metaColumnById } = useViewColumnsOrThrow()

const vModel = useVModel(props, 'modelValue', emit)

const { setAdditionalValidations, validateInfos, column, isEdit } = useColumnCreateStoreOrThrow()

const { t } = useI18n()

const columnsAllowedAsBarcodeValue = computed<ColumnType[]>(() => {
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
  vModel.value.meta = {
    ...columnDefaultMeta[UITypes.Barcode],
    ...(vModel.value.meta || {}),
  }
  vModel.value.fk_barcode_value_column_id =
    (column?.value?.colOptions as Record<string, any>)?.fk_barcode_value_column_id ||
    (!isEdit.value ? columnsAllowedAsBarcodeValue.value?.[0]?.id : null)
})

watch(columnsAllowedAsBarcodeValue, (newColumnsAllowedAsBarcodeValue) => {
  if (vModel.value.fk_barcode_value_column_id === null) {
    vModel.value.fk_barcode_value_column_id = newColumnsAllowedAsBarcodeValue?.[0]?.id
  }
})

setAdditionalValidations({
  fk_barcode_value_column_id: [{ required: true, message: t('general.required') }],
  barcode_format: [{ required: true, message: t('general.required') }],
})

const showBarcodeValueColumnInfoIcon = computed(() => !columnsAllowedAsBarcodeValue.value?.length)

const cellIcon = (column: ColumnType) =>
  h(isVirtualCol(column) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: column,
  })
</script>

<template>
  <div class="flex flex-col gap-4">
    <a-form-item
      class="flex pb-2 nc-barcode-value-column-select flex-row"
      :label="`${$t('placeholder.value')} ${t('objects.field').toLowerCase()}`"
      v-bind="validateInfos.fk_barcode_value_column_id"
    >
      <div class="flex flex-row items-center">
        <a-select
          v-model:value="vModel.fk_barcode_value_column_id"
          :placeholder="$t('placeholder.barcodeColumn')"
          :not-found-content="$t('placeholder.notFoundContent')"
          @click.stop
        >
          <template #suffixIcon> <GeneralIcon icon="arrowDown" class="text-gray-700" /> </template>

          <a-select-option v-for="(option, index) of columnsAllowedAsBarcodeValue" :key="index" :value="option.id">
            <div class="w-full flex gap-2 truncate items-center justify-between" :data-testid="`nc-barcode-${option.title}`">
              <div class="inline-flex items-center gap-2 flex-1 truncate">
                <component :is="cellIcon(option)" :column-meta="option" class="!mx-0" />
                <div class="truncate flex-1">{{ option.title }}</div>
              </div>

              <component
                :is="iconMap.check"
                v-if="vModel.fk_barcode_value_column_id === option.id"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
              />
            </div>
          </a-select-option>
        </a-select>
        <div v-if="showBarcodeValueColumnInfoIcon" class="pl-2">
          <a-tooltip placement="bottom">
            <template #title>
              <span>
                {{ $t('msg.validColumnsForBarCode') }}
              </span>
            </template>
            <component :is="iconMap.info" class="cursor-pointer" />
          </a-tooltip>
        </div>
      </div>
    </a-form-item>
    <a-form-item class="flexp nc-barcode-format-select" :label="$t('general.format')" v-bind="validateInfos.barcode_format">
      <a-select
        v-model:value="vModel.meta.barcodeFormat"
        :options="supportedBarcodeFormats"
        :placeholder="$t('placeholder.selectBarcodeFormat')"
        @click.stop
      >
        <template #suffixIcon> <GeneralIcon icon="arrowDown" class="text-gray-700" /> </template
      ></a-select>
    </a-form-item>
  </div>
</template>
