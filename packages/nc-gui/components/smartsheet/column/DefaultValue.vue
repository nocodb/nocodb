<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()
const emits = defineEmits(['update:value'])

provide(EditColumnInj, ref(true))

const vModel = useVModel(props, 'value', emits)
const rowRef = ref({
  row: {},
  oldRow: {},
  rowMeta: {
    isUpdatedFromCopyNPaste: [vModel.value?.title],
  },
})

useProvideSmartsheetRowStore(rowRef)

const cdfValue = ref<string | null>(null)

const editEnabled = ref(false)

const updateCdfValue = (cdf: string | null) => {
  vModel.value = { ...vModel.value, cdf }
  cdfValue.value = cdf
}

onMounted(() => {
  updateCdfValue(vModel.value?.cdf ? vModel.value.cdf : null)
})

watch(
  () => vModel.value.cdf,
  (newValue) => {
    cdfValue.value = newValue
  },
)
</script>

<template>
  <div class="flex flex-row gap-2">
    <div
      class="border-1 flex items-center w-full px-3 border-gray-300 rounded-lg sm:min-h-[32px] xs:min-h-13 flex items-center hover:border-brand-400 focus-within:(border-brand-500 shadow-selected ring-0) transition-all duration-0.3s"
      :class="{
        '!border-brand-500': editEnabled,
      }"
    >
      <LazySmartsheetCell
        :edit-enabled="true"
        :model-value="cdfValue"
        :column="vModel"
        class="!border-none h-auto my-auto"
        @update:cdf="updateCdfValue"
        @update:edit-enabled="editEnabled = $event"
        @click="editEnabled = true"
      />
    </div>
  </div>
</template>
