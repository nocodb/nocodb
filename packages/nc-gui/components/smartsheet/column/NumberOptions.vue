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
if (!vModel.value.meta.separator) {
  vModel.value.meta.separator = resolveColumnSeparator(vModel.value.meta)
}
</script>

<template>
  <SmartsheetColumnSeparatorSelect
    v-model:value="vModel.meta.separator"
    :disabled="isSystem"
    integer
    dropdown-class-name="nc-dropdown-number-separator-format"
  />

  <a-form-item>
    <div class="flex items-center gap-1">
      <NcSwitch
        v-model:checked="vModel.meta.abbreviate"
        v-e="['c:column:number:abbreviate:toggle']"
        :disabled="isSystem"
        data-testid="nc-number-abbreviate"
      >
        <div class="text-sm text-nc-content-gray select-none">{{ $t('labels.abbreviateNumbers') }}</div>
      </NcSwitch>
    </div>
  </a-form-item>
</template>
