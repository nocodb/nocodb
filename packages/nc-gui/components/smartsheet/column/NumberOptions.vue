<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

// set default value
vModel.value.meta = {
  ...columnDefaultMeta[UITypes.Number],
  ...(vModel.value.meta || {}),
}
</script>

<template>
  <a-form-item>
    <div class="flex items-center gap-1">
      <NcSwitch v-if="vModel.meta" v-model:checked="vModel.meta.isLocaleString">
        <div class="text-sm text-gray-800 select-none">{{ $t('labels.showThousandsSeparator') }}</div>
      </NcSwitch>
    </div>
  </a-form-item>
</template>
