<script setup lang="ts">
import { useColumnCreateStoreOrThrow, useVModel } from '#imports'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const { validateInfos, setAdditionalValidations } = useColumnCreateStoreOrThrow()

setAdditionalValidations({})

// set default value
vModel.value.meta = {
  format: 'escape',
  ...(vModel.value.meta || {}),
}
</script>

<template>
  <a-row class="my-2" gutter="8">
    <a-col :span="24">
      <a-form-item v-bind="validateInfos['meta.format']" :label="$t('labels.binaryEncodingFormat')">
        <a-select
          v-model:value="vModel.meta.format"
          :placeholder="$t('labels.binaryEncodingFormat')"
          class="!w-full nc-link-singular"
        >
          <a-select-option value="escape">{{ $t('general.escape') }}</a-select-option>
          <a-select-option value="hex">{{ $t('general.hex') }}</a-select-option>
        </a-select>
      </a-form-item>
    </a-col>
  </a-row>
</template>
