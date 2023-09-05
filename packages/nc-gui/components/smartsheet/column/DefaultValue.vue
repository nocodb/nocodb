<script lang="ts" setup>
const props = defineProps<{
  value: any
}>()
const emit = defineEmits(['update:value'])

const column = inject(ColumnInj)

provide('isAdvancedOption', ref(true))

const rowRef = ref({
  row: {},
  oldRow: {},
  rowMeta: {
    isUpdatedFromCopyNPaste: [column?.value.title],
  },
})

const vModel = useVModel(props, 'value', emit)

const cdfValue = computed(() => {
  if (
    vModel.value.uidt === 'LongText' ||
    vModel.value.uidt === 'Email' ||
    vModel.value.uidt === 'URL' ||
    vModel.value.uidt === 'PhoneNumber'
  ) {
    const transformed = (vModel.value.cdf ? vModel.value.cdf : '').match(/'((?:"""[^"]*"""|'[^']*'|[^'"]+)*)'::\w+/)
    if (transformed) {
      return transformed[1]
    }
  }
  return vModel.value.cdf
})

useProvideSmartsheetRowStore(vModel, rowRef)
</script>

<template>
  <p class="mt-3 text-[0.75rem]">Default Value</p>
  <div class="border-1 pl-2 my-[-4px] border-gray-300 rounded-md">
    <LazySmartsheetCell :column="vModel" :model-value="cdfValue" :edit-enabled="true" />
  </div>
</template>

<style scoped></style>
