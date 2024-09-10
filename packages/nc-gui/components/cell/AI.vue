<script setup lang="ts">
import type { AIRecordType } from 'nocodb-sdk'

interface Props {
  modelValue?: AIRecordType | string | null
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

const aiRecordMeta = ref<AIRecordType>({})

const pk = computed(() => {
  if (!meta.value?.columns) return
  return extractPkFromRow(unref(row).row, meta.value.columns)
})

const handleDataChange = () => {
  if (vModel.value) {
    if (typeof vModel.value === 'string') {
      aiRecordMeta.value = {
        value: vModel.value,
      }
    } else {
      aiRecordMeta.value = {
        ...vModel.value,
      }

      vModel.value = aiRecordMeta.value.value
    }
  }
}

const generate = async () => {
  if (!meta?.value?.id || !meta.value.columns || !column?.value?.id) return

  if (!pk.value) return

  generatingRows.value.push(pk.value)

  const res = await generateRows(meta.value.id, column.value.id, [pk.value])

  if (res?.length) {
    const row = res[0]
    const obj: AIRecordType = row[column.value.title!]
    if (obj && typeof obj === 'object') {
      vModel.value = obj.value
      aiRecordMeta.value = {
        ...obj,
      }
    }
  }

  generatingRows.value = generatingRows.value.filter((v) => v !== pk.value)
}

onMounted(() => {
  handleDataChange()
})
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
    v-else-if="typeof vModel === 'string'"
    v-model="vModel"
    :is-ai="true"
    :ai-meta="aiRecordMeta"
    @generate="generate"
    @close="editEnabled = false"
  />
</template>

<style scoped lang="scss">
.nc-cell-button {
  @apply rounded-lg px-2 py-1 flex items-center gap-2 transition-all justify-center bg-gray-100 hover:bg-gray-200;
}
</style>
