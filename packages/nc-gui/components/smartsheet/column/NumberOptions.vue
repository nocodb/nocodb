<script setup lang="ts">
import { ColumnHelper, UITypes, resolveColumnSeparator } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

// set default value
vModel.value.meta = {
  ...ColumnHelper.getColumnDefaultMeta(UITypes.Number),
  ...(vModel.value.meta || {}),
}

const { isSystem } = useColumnCreateStoreOrThrow()

// Backward compat: resolve isLocaleString to separator if separator is not yet set
vModel.value.meta.separator = resolveColumnSeparator(vModel.value.meta)
</script>

<template>
  <SmartsheetColumnSeparatorSelect
    v-model:value="vModel.meta.separator"
    :disabled="isSystem"
    integer
    dropdown-class-name="nc-dropdown-number-separator-format"
  />
</template>
