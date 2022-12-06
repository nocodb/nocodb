<script setup lang="ts">
import JsBarcodeWrapper from './JsBarcodeWrapper'

const maxNumberOfAllowedCharsForQrValue = 2000

const cellValue = inject(CellValueInj)

const column = inject(ColumnInj)

const barcodeValue = computed(() => String(cellValue?.value))

const tooManyCharsForQrCode = computed(() => barcodeValue?.value.length > maxNumberOfAllowedCharsForQrValue)

const modalVisible = ref(false)

const showQrModal = (ev: MouseEvent) => {
  ev.stopPropagation()
  modalVisible.value = true
}

const barcodeMeta = $computed(() => {
  return {
    barcodeFormat: 'CODE128',
    ...(column?.value?.meta || {}),
  }
})

const jsBarcodeOptions = $computed(() => ({
  format: barcodeMeta.barcodeFormat,
  // format: 'CODE128',
}))

const handleModalOkClick = () => (modalVisible.value = false)

const { showEditNonEditableFieldWarning, showClearNonEditableFieldWarning } = useShowNotEditableWarning()
</script>

<template>
  <a-modal
    v-model:visible="modalVisible"
    :class="{ active: modalVisible }"
    wrap-class-name="nc-qr-code-large amodal-wrapper"
    :body-style="{ padding: '0px' }"
    :footer="null"
    @ok="handleModalOkClick"
  >
    <JsBarcodeWrapper
      v-if="barcodeValue && !tooManyCharsForQrCode"
      :options="jsBarcodeOptions"
      tag="svg"
      :value="barcodeValue"
      width="3"
    />
  </a-modal>
  <div @click="showQrModal">
    FOO: {{ JSON.stringify(jsBarcodeOptions) }}
    <JsBarcodeWrapper
      v-if="barcodeValue && !tooManyCharsForQrCode"
      :options="jsBarcodeOptions"
      tag="svg"
      class="w-full"
      :value="barcodeValue"
      width="3"
    ></JsBarcodeWrapper>
  </div>

  <div v-if="tooManyCharsForQrCode" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('labels.barcodeValueTooLong') }}
  </div>
  <div v-if="showEditNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('msg.warning.nonEditableFields.computedFieldUnableToClear') }}
  </div>
  <div v-if="showClearNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
    {{ $t('msg.warning.nonEditableFields.qrFieldsCannotBeDirectlyChanged') }}
  </div>
</template>

<style lang="scss">
.amodal-wrapper {
  // width: 100px;
}
</style>
