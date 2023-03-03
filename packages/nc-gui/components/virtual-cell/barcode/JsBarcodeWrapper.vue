<script lang="ts" setup>
import JsBarcode from 'jsbarcode'
import { onMounted } from '#imports'

const props = defineProps({
  barcodeValue: { type: String, required: true },
  barcodeFormat: { type: String, required: true },
  customStyle: { type: Object, required: false },
})

const emit = defineEmits(['onClickBarcode'])

const barcodeImgRef = ref<HTMLElement>()
const errorForCurrentInput = ref(false)

const generate = () => {
  try {
    JsBarcode(barcodeImgRef.value, String(props.barcodeValue), {
      format: props.barcodeFormat,
    })
    if (props.customStyle) {
      if (barcodeImgRef.value) {
        for (const key in props.customStyle) {
          barcodeImgRef.value.style.setProperty(key, props.customStyle[key])
        }
      }
    }
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

watch([() => props.barcodeValue, () => props.barcodeFormat, () => props.customStyle], generate)
onMounted(generate)
</script>

<template>
  <img
    v-show="!errorForCurrentInput"
    ref="barcodeImgRef"
    class="ml-auto mr-auto"
    alt="barcode"
    data-testid="barcode"
    @click="onBarcodeClick"
  />
  <slot v-if="errorForCurrentInput" name="barcodeRenderError" />
</template>
