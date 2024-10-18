<script setup lang="ts">
import type { AIRecordType } from 'nocodb-sdk'

interface Props {
  modelValue?: AIRecordType | null
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue', 'save'])

const { aiIntegrationAvailable, aiLoading, generateRows, generatingRows, generatingColumnRows } = useNocoAi()

const { row } = useSmartsheetRowStoreOrThrow()

const meta = inject(MetaInj, ref())

const column = inject(ColumnInj)

const editEnabled = inject(EditModeInj, ref(false))

const readOnly = inject(ReadonlyInj, ref(false))

const isGrid = inject(IsGridInj, ref(false))

const isGallery = inject(IsGalleryInj, ref(false))

const isKanban = inject(IsKanbanInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const vModel = useVModel(props, 'modelValue', emits)

const isAiEdited = ref(false)

const pk = computed(() => {
  if (!meta.value?.columns) return
  return extractPkFromRow(unref(row).row, meta.value.columns)
})

const generate = async () => {
  if (!meta?.value?.id || !meta.value.columns || !column?.value?.id) return

  if (!pk.value) return
  const outputColumnIds =
    ncIsString(column.value.colOptions?.output_column_ids) && column.value.colOptions.output_column_ids.split(',').length > 1
      ? column.value.colOptions.output_column_ids.split(',')
      : []
  const outputColumns = outputColumnIds.map((id) => meta.value?.columnsById[id])

  generatingRows.value.push(pk.value)
  generatingColumnRows.value.push(column.value.id)

  const res = await generateRows(meta.value.id, column.value.id, [pk.value], false, isExpandedForm.value ? true : false)

  if (res?.length) {
    const resRow = res[0]

    if (outputColumnIds.length) {
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
  generatingColumnRows.value = generatingColumnRows.value.filter((v) => v !== column.value.id)
}

const handleSave = () => {
  emits('save')
}

const debouncedSave = useDebounceFn(handleSave, 1000)
</script>

<template>
  <div
    v-if="(!readOnly || isGallery || isKanban) && !vModel"
    class="flex items-center w-full"
    :class="{
      'justify-center': isGrid && !isExpandedForm,
    }"
  >
    <button
      class="nc-cell-ai-button nc-cell-button h-7"
      size="small"
      :disabled="!aiIntegrationAvailable || aiLoading"
      @click.stop="generate"
    >
      <div class="flex items-center gap-1">
        <GeneralLoader
          v-if="pk && generatingRows.includes(pk) && column?.id && generatingColumnRows.includes(column.id)"
          size="regular"
        />
        <GeneralIcon v-else icon="ncAutoAwesome" class="text-nc-content-purple-dark h-4 w-4" />
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
  @apply rounded-lg px-2 flex items-center gap-2 transition-all justify-center md:(hover:bg-gray-100) border-1 border-nc-border-gray-medium;

  box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);
}
</style>

<style lang="scss">
.nc-data-cell {
  &:has(.nc-cell-ai-button) {
    @apply !border-none;
    box-shadow: none !important;
  }
}
</style>
