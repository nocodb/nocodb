<script setup lang="ts">
import type { UITypes } from 'nocodb-sdk'
import { AllowedColumnTypesForQrAndBarcodes } from 'nocodb-sdk'
import type { SelectProps } from 'ant-design-vue'
import { iconMap, onMounted, useVModel, watch } from '#imports'

const props = defineProps<{
  modelValue: any
}>()

const emit = defineEmits(['update:modelValue'])

const { fields, metaColumnById } = useViewColumnsOrThrow()

const vModel = useVModel(props, 'modelValue', emit)

const { setAdditionalValidations, validateInfos, column } = useColumnCreateStoreOrThrow()

const { t } = useI18n()

const columnsAllowedAsBarcodeValue = computed<SelectProps['options']>(() => {
  return fields.value
    ?.filter(
      (el) =>
        el.fk_column_id && AllowedColumnTypesForQrAndBarcodes.includes(metaColumnById.value[el.fk_column_id].uidt as UITypes),
    )
    .map((field) => {
      return {
        value: field.fk_column_id,
        label: field.title,
      }
    })
})

const supportedBarcodeFormats = [
  { value: 'CODE128', label: 'CODE128' },
  { value: 'upc', label: 'UPC' },
  { value: 'EAN13', label: 'EAN-13' },
  { value: 'EAN8', label: 'EAN-8' },
  { value: 'EAN5', label: 'EAN-5' },
  { value: 'EAN2', label: 'EAN-2' },
  { value: 'CODE39', label: 'CODE39' },
  { value: 'ITF14', label: 'ITF-14' },
  { value: 'MSI', label: 'MSI' },
  { value: 'PHARMACODE', label: 'pharmacode' },
  { value: 'CODABAR', label: 'codabar' },
]

onMounted(() => {
  // set default value
  vModel.value.meta = {
    barcodeFormat: supportedBarcodeFormats[0].value,
    ...vModel.value.meta,
  }
  vModel.value.fk_barcode_value_column_id =
    (column?.value?.colOptions as Record<string, any>)?.fk_barcode_value_column_id ||
    columnsAllowedAsBarcodeValue.value?.[0]?.value
})

watch(columnsAllowedAsBarcodeValue, (newColumnsAllowedAsBarcodeValue) => {
  if (vModel.value.fk_barcode_value_column_id === null) {
    vModel.value.fk_barcode_value_column_id = newColumnsAllowedAsBarcodeValue?.[0]?.value
  }
})

setAdditionalValidations({
  fk_barcode_value_column_id: [{ required: true, message: t('general.required') }],
  barcode_format: [{ required: true, message: t('general.required') }],
})

const showBarcodeValueColumnInfoIcon = computed(() => !columnsAllowedAsBarcodeValue.value?.length)
</script>

<template>
  <a-row>
    <a-col :span="24">
      <a-form-item
        class="flex pb-2 nc-barcode-value-column-select flex-row"
        :label="$t('labels.barcodeValueColumn')"
        v-bind="validateInfos.fk_barcode_value_column_id"
      >
        <div class="flex w-1/2 flex-row items-center">
          <a-select
            v-model:value="vModel.fk_barcode_value_column_id"
            :options="columnsAllowedAsBarcodeValue"
            :placeholder="$t('placeholder.barcodeColumn')"
            :not-found-content="$t('placeholder.notFoundContent')"
            @click.stop
          />
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
      <a-form-item
        class="flex w-1/2 pb-2 nc-barcode-format-select"
        :label="$t('labels.barcodeFormat')"
        v-bind="validateInfos.barcode_format"
      >
        <a-select
          v-model:value="vModel.meta.barcodeFormat"
          :options="supportedBarcodeFormats"
          :placeholder="$t('placeholder.selectBarcodeFormat')"
          @click.stop
        />
      </a-form-item>
    </a-col>
  </a-row>
</template>
