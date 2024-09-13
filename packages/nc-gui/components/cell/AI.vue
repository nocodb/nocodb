<script setup lang="ts">
import type { AIRecordType } from 'nocodb-sdk'

interface Props {
  modelValue?: AIRecordType | null
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue', 'save'])

const { aiIntegrationAvailable, aiLoading, generateRows, generatingRows } = useNocoAi()

const { row } = useSmartsheetRowStoreOrThrow()

const meta = inject(MetaInj, ref())

const column = inject(ColumnInj)

const editEnabled = inject(EditModeInj, ref(false))

const readOnly = inject(ReadonlyInj, ref(false))

const vModel = useVModel(props, 'modelValue', emits)

const isAiEdited = ref(false)

const pk = computed(() => {
  if (!meta.value?.columns) return
  return extractPkFromRow(unref(row).row, meta.value.columns)
})

const generate = async () => {
  if (!meta?.value?.id || !meta.value.columns || !column?.value?.id) return

  if (!pk.value) return

  generatingRows.value.push(pk.value)

  const res = await generateRows(meta.value.id, column.value.id, [pk.value])

  if (res?.length) {
    const resRow = res[0]

    if (column.value.colOptions?.output_column_ids && column.value.colOptions.output_column_ids.split(',').length > 1) {
      const outputColumnIds = column.value.colOptions.output_column_ids.split(',')
      const outputColumns = outputColumnIds.map((id) => meta.value?.columnsById[id])
      for (const col of outputColumns) {
        if (col) {
          unref(row).row[col.title!] = resRow[col.title!]
        }
      }
    } else {
      const obj: AIRecordType = resRow[column.value.title!]
      if (obj && typeof obj === 'object') {
        vModel.value = obj
        setTimeout(() => {
          isAiEdited.value = false
        }, 100)
      }
    }
  }

  generatingRows.value = generatingRows.value.filter((v) => v !== pk.value)
}

const handleSave = () => {
  emits('save')
}

const debouncedSave = useDebounceFn(handleSave, 1000)
</script>

<template>
  <div v-if="!readOnly && !vModel" class="flex justify-center w-full">
    <button
      class="nc-cell-button !shadow-default"
      size="small"
      :disabled="!aiIntegrationAvailable || aiLoading"
      @click="generate"
    >
      <div class="flex items-center gap-1">
        <GeneralLoader v-if="pk && generatingRows.includes(pk)" size="small" />
        <GeneralIcon v-else icon="magic" class="text-purple-500" />
        <span class="text-sm font-bold">Generate</span>
      </div>
    </button>
  </div>

  <LazyCellTextArea
    v-else-if="vModel"
    v-model="vModel.value"
    v-model:is-ai-edited="isAiEdited"
    :is-ai="true"
    :ai-meta="vModel"
    @update:model-value="debouncedSave"
    @generate="generate"
    @close="editEnabled = false"
  />
</template>

<style scoped lang="scss">
.nc-cell-button {
  @apply rounded-lg px-2 py-1 flex items-center gap-2 transition-all justify-center bg-gray-100 hover:bg-gray-200;
}
</style>
