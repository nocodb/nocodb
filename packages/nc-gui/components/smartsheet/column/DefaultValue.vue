<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()
const emit = defineEmits(['update:value'])

provide(EditColumnInj, ref(true))

const vModel = useVModel(props, 'value', emit)
const rowRef = ref({
  row: {},
  oldRow: {},
  rowMeta: {
    isUpdatedFromCopyNPaste: [vModel?.value.title],
  },
})

const cdfValue = computed({
  get: () => {
    if (vModel.value.uidt === UITypes.MultiSelect || vModel.value.uidt === UITypes.SingleSelect) {
      return (vModel.value.cdf ?? '').replaceAll("'", '')
    } else if (
      vModel.value.uidt === UITypes.SingleLineText ||
      vModel.value.uidt === UITypes.LongText ||
      vModel.value.uidt === UITypes.Email ||
      vModel.value.uidt === UITypes.URL ||
      vModel.value.uidt === UITypes.JSON
    ) {
      return (vModel.value.cdf ?? '').replace(/^'/, '').replace(/'$/, '')
    }
    return vModel.value.cdf
  },
  set: (value) => {
    vModel.value.cdf = value
  },
})

useProvideSmartsheetRowStore(vModel, rowRef)
</script>

<template>
  <p class="mt-3 text-gray-900">Default Value</p>
  <div class="flex flex-row gap-2">
    <div class="border-1 w-full px-1 my-[-4px] border-gray-300 rounded-md">
      <LazySmartsheetCell :column="vModel" :model-value="cdfValue" :edit-enabled="true" />
    </div>
  </div>
</template>

<style scoped></style>
