<script setup lang="ts">
import { useVModel } from '#imports'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const precisionFormats = [1, 2, 3, 4, 5, 6, 7, 8]

const precisionFormatsDisplay = {
  1: '1.0',
  2: '1.00',
  3: '1.000',
  4: '1.0000',
  5: '1.00000',
  6: '1.000000',
  7: '1.0000000',
  8: '1.00000000',
}

const vModel = useVModel(props, 'value', emit)

onMounted(() => {
  if (!vModel.value.meta?.precision) {
    if (!vModel.value.meta) vModel.value.meta = {}
    vModel.value.meta.precision = precisionFormats[0]
  }
})
</script>

<template>
  <a-form-item label="Precision">
    <a-select v-model:value="vModel.meta.precision" dropdown-class-name="nc-dropdown-decimal-format">
      <a-select-option v-for="(format, i) of precisionFormats" :key="i" :value="format">
        <div class="flex flex-row items-center">
          <div class="text-xs">
            {{ (precisionFormatsDisplay as any)[format] }}
          </div>
        </div>
      </a-select-option>
    </a-select>
  </a-form-item>
</template>
