<script setup lang="ts">
import type { UITypes } from 'nocodb-sdk'
import { AllowedColumnTypesForQrAndBarcodes } from 'nocodb-sdk'
import type { SelectProps } from 'ant-design-vue'
import { useVModel } from '#imports'

const props = defineProps<{
  modelValue: any
}>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const { fields, metaColumnById } = useViewColumnsOrThrow()

const vModel = useVModel(props, 'modelValue', emit)

const { setAdditionalValidations, validateInfos, column } = useColumnCreateStoreOrThrow()

const columnsAllowedAsQrValue = computed<SelectProps['options']>(() => {
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

onMounted(() => {
  // set default value
  vModel.value.fk_qr_value_column_id =
    (column?.value?.colOptions as Record<string, any>)?.fk_qr_value_column_id || columnsAllowedAsQrValue.value?.[0]?.value
})

setAdditionalValidations({
  fk_qr_value_column_id: [{ required: true, message: t('general.required') }],
})
</script>

<template>
  <a-row>
    <a-col :span="24">
      <a-form-item
        class="flex w-1/2 pb-2 nc-qr-code-value-column-select"
        :label="$t('labels.qrCodeValueColumn')"
        v-bind="validateInfos.fk_qr_value_column_id"
      >
        <a-select
          v-model:value="vModel.fk_qr_value_column_id"
          :options="columnsAllowedAsQrValue"
          :placeholder="$t('placeholder.selectAColumnForTheQRCodeValue')"
          @click.stop
        />
      </a-form-item>
    </a-col>
  </a-row>
</template>
