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

useProvideSmartsheetRowStore(vModel, rowRef)
</script>

<template>
  <p class="mt-3 text-[0.75rem]">Default Value</p>
  <div class="border-1 px-1 my-[-4px] border-gray-300 rounded-md">
    <LazySmartsheetCell :column="vModel" :model-value="vModel.cdf" :edit-enabled="true" />
  </div>
</template>

<style scoped></style>
