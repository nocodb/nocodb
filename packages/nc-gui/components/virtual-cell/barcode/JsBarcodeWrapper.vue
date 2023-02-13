<script lang="ts" setup>
import JsBarcode from 'jsbarcode'
import { onMounted } from '#imports'

const props = defineProps({
  barcodeValue: { type: String, required: true },
  barcodeFormat: { type: String, required: true },
  customStyle: { type: Object, required: false },
})

const emit = defineEmits(['onClickBarcode'])

const barcodeSvgRef = ref<HTMLElement>()
const errorForCurrentInput = ref(false)

const generate = () => {
  try {
    JsBarcode(barcodeSvgRef.value, String(props.barcodeValue), {
      format: props.barcodeFormat,
    })
    if (props.customStyle) {
      if (barcodeSvgRef.value) {
        for (const key in props.customStyle) {
          barcodeSvgRef.value.style.setProperty(key, props.customStyle[key])
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
  <svg v-show="!errorForCurrentInput" ref="barcodeSvgRef" class="w-full" data-testid="barcode" @click="onBarcodeClick"></svg>
  <slot v-if="errorForCurrentInput" name="barcodeRenderError" />
</template>
