<script lang="ts" setup>
import JsBarcode from 'jsbarcode'

const props = defineProps({
  barcodeValue: { type: String, required: true },
  barcodeFormat: { type: String, required: true },
})
const emit = defineEmits(['onClickBarcode'])
const barcodeSvgRef = ref(null)
const errorForCurrentInput = ref(false)
const generate = () => {
  try {
    JsBarcode(barcodeSvgRef.value, String(props.barcodeValue), {
      format: props.barcodeFormat,
    })
    errorForCurrentInput.value = false
  } catch (e) {
    console.log('e', e)
    errorForCurrentInput.value = true
  }
}

const onBarcodeClick = (ev: MouseEvent) => {
  ev.stopPropagation()
  emit('onClickBarcode')
}

watch(() => props.barcodeValue, generate)
watch(() => props.barcodeFormat, generate)
onMounted(generate)
</script>

<template>
  <svg data-testid="barcode" v-show="!errorForCurrentInput" ref="barcodeSvgRef" @click="onBarcodeClick"></svg>
  <slot v-if="errorForCurrentInput" name="barcodeRenderError" />
</template>

<style scoped>
svg {
  width: 100%;
}
</style>
