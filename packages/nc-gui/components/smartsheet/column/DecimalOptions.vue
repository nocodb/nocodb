<script setup lang="ts">
import { useVModel } from '#imports'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const precisionFormats = [1, 2, 3, 4, 5, 6, 7, 8]

const { t } = useI18n()

const precisionFormatsDisplay = {
  1: t('placeholder.decimal1'),
  2: t('placeholder.decimal2'),
  3: t('placeholder.decimal3'),
  4: t('placeholder.decimal4'),
  5: t('placeholder.decimal5'),
  6: t('placeholder.decimal6'),
  7: t('placeholder.decimal7'),
  8: t('placeholder.decimal8'),
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
  <a-form-item :label="$t('placeholder.precision')">
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
