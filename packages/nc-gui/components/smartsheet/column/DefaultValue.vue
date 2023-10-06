<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'
import { iconMap } from '#imports'

const props = defineProps<{
  value: any
}>()
const emits = defineEmits(['update:value'])

const meta = inject(MetaInj, ref())

provide(EditColumnInj, ref(true))

const vModel = useVModel(props, 'value', emits)
const rowRef = ref({
  row: {},
  oldRow: {},
  rowMeta: {
    isUpdatedFromCopyNPaste: [vModel.value?.title],
  },
})

useProvideSmartsheetRowStore(meta, rowRef)

const cdfValue = ref<string | null>(null)

const updateCdfValue = (cdf: string | null) => {
  vModel.value.cdf = cdf
  cdfValue.value = vModel.value.cdf
}

onMounted(() => {
  updateCdfValue(vModel.value?.cdf ? vModel.value.cdf : null)
})
</script>

<template>
  <div class="!my-3 text-xs">{{ $t('placeholder.defaultValue') }}</div>
  <div class="flex flex-row gap-2">
    <div class="border-1 flex items-center w-full px-3 my-[-4px] border-gray-300 rounded-md">
      <LazySmartsheetCell
        :model-value="cdfValue"
        :column="vModel"
        :edit-enabled="true"
        class="!border-none"
        @update:cdf="updateCdfValue"
      />
      <component
        :is="iconMap.close"
        v-if="![UITypes.Year, UITypes.SingleSelect, UITypes.MultiSelect].includes(vModel.uidt)"
        class="w-4 h-4 cursor-pointer rounded-full !text-black-500 text-gray-500 cursor-pointer hover:bg-gray-50"
        @click="cdfValue = null"
      />
    </div>
  </div>
</template>
