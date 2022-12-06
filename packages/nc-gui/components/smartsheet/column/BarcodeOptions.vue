<script setup lang="ts">
import type { UITypes } from 'nocodb-sdk'
import { AllowedColumnTypesForQrAndBarcodes } from 'nocodb-sdk'
import type { SelectProps } from 'ant-design-vue'
import { useVModel } from '#imports'

const props = defineProps<{
  modelValue: any
}>()

const emit = defineEmits(['update:modelValue'])

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const reloadDataHook = inject(ReloadViewDataHookInj)!

const { fields, metaColumnById } = useViewColumns(activeView, meta, () => reloadDataHook.trigger())

const vModel = useVModel(props, 'modelValue', emit)

const { setAdditionalValidations, validateInfos, column } = useColumnCreateStoreOrThrow()

const columnsAllowedAsQrValue = computed<SelectProps['options']>(() => {
  return fields.value
    ?.filter(
      (el) =>
        el.fk_column_id &&
        // AllowedColumnTypesForQrCode.map((el) => el.toString()).includes(metaColumnById.value[el.fk_column_id].uidt),
        AllowedColumnTypesForQrAndBarcodes.includes(metaColumnById.value[el.fk_column_id].uidt as UITypes),
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
  { value: 'UPC', label: 'UPC' },
  { value: 'EAN13', label: 'EAN13' },
  { value: 'EAN8', label: 'EAN8' },
  { value: 'EAN5', label: 'EAN5' },
  { value: 'EAN2', label: 'EAN2' },
  { value: 'CODE39', label: 'CODE39' },
  { value: 'ITF14', label: 'ITF14' },
  { value: 'MSI', label: 'MSI' },
  { value: 'PHARMACODE', label: 'pharmacode' },
  { value: 'CODEBAR', label: 'codabar' },
]

onMounted(() => {
  // set default value
  vModel.value.fk_barcode_value_column_id = (column?.value?.colOptions as Record<string, any>)?.fk_barcode_value_column_id || ''
  // vModel.value.meta.barcode_format = (column?.value?.colOptions as Record<string, any>)?.barcode_format || ''
})

setAdditionalValidations({
  fk_barcode_value_column_id: [{ required: true, message: 'Required' }],
  barcode_format: [{ required: true, message: 'Required' }],
})

// set default meta value
vModel.value.meta = {
  barcodeFormat: supportedBarcodeFormats[0].value,
  ...vModel.value.meta,
}
</script>

<template>
  <a-row>
    <a-col :span="24">
      <a-form-item
        class="flex w-1/2 pb-2 nc-qr-code-value-column-select"
        :label="$t('labels.barcodeValueColumn')"
        v-bind="validateInfos.fk_barcode_value_column_id"
      >
        <a-select
          v-model:value="vModel.fk_barcode_value_column_id"
          :options="columnsAllowedAsQrValue"
          placeholder="Select a column for the Barcode value"
          @click.stop
        />
      </a-form-item>
      <a-form-item
        class="flex w-1/2 pb-2 nc-qr-code-value-column-select"
        :label="$t('labels.barcodeFormat')"
        v-bind="validateInfos.barcode_format"
      >
        <a-select
          v-model:value="vModel.meta.barcodeFormat"
          :options="supportedBarcodeFormats"
          placeholder="Select a Barcode format"
          @click.stop
        />
      </a-form-item>
    </a-col>
  </a-row>
</template>
