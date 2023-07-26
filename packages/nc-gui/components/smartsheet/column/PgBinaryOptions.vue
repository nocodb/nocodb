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
      <a-form-item v-bind="validateInfos['meta.format']" label="Binary encoding format">
        <a-select v-model:value="vModel.meta.format" placeholder="Binary encoding format" class="!w-full nc-link-singular">
          <a-select-option value="escape">Escape</a-select-option>
          <a-select-option value="hex">Hex</a-select-option>
        </a-select>
      </a-form-item>
    </a-col>
  </a-row>
</template>
