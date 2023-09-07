<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'
import MdiPlusIcon from '~icons/mdi/plus-circle-outline'

const props = defineProps<{
  value: any
}>()
const emit = defineEmits(['update:value'])

const enableDefaultOption = ref(false)

const column = inject(ColumnInj)

provide(EditColumnInj, ref(true))

const rowRef = ref({
  row: {},
  oldRow: {},
  rowMeta: {
    isUpdatedFromCopyNPaste: [column?.value.title],
  },
})
const vModel = useVModel(props, 'value', emit)

const cdfValue = computed({
  get: () => {
    if (column?.value.uidt === UITypes.MultiSelect || column?.value.uidt === UITypes.SingleSelect) {
      return vModel.value.cdf?.replaceAll("'", '')
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
  <span v-if="!enableDefaultOption && !vModel.cdf" class="cursor-pointer" @click="enableDefaultOption = !enableDefaultOption">
    <MdiPlusIcon class="text-gray-600" />
    Set Default Value
  </span>
  <div v-else>
    <p class="mt-3 text-gray-900">Default Value</p>
    <div class="flex flex-row gap-2">
      <div class="border-1 w-full px-1 my-[-4px] border-gray-300 rounded-md">
        <LazySmartsheetCell :column="vModel" :model-value="cdfValue" :edit-enabled="true" />
      </div>
      <MdiDeleteOutline
        class="w-6 h-6 text-red-500 cursor-pointer"
        @click="
          () => {
            vModel.cdf = null
            enableDefaultOption = false
          }
        "
      />
    </div>
  </div>
</template>

<style scoped></style>
