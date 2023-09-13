<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'
import { iconMap } from '#imports'

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
      vModel.value.uidt === UITypes.JSON ||
      vModel.value.uidt === UITypes.DateTime ||
      vModel.value.uidt === UITypes.Time ||
      vModel.value.uidt === UITypes.Year ||
      vModel.value.uidt === UITypes.Date
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
  <div class="!my-3 text-xs">Default Value</div>
  <div class="flex flex-row gap-2">
    <div class="border-1 flex items-center w-full px-1 my-[-4px] border-gray-300 rounded-md">
      <LazySmartsheetCell :column="vModel" :model-value="cdfValue" :edit-enabled="true" />
      <component
        :is="iconMap.close"
        v-if="vModel.uidt !== UITypes.Year"
        class="w-4 h-4 cursor-pointer rounded-full !text-black-500 text-gray-500 cursor-pointer hover:bg-gray-50"
        @click="cdfValue = null"
      />
    </div>
  </div>
</template>

<style scoped></style>
