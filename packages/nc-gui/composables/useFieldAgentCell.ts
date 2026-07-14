import type { ColumnType } from 'nocodb-sdk'
import { isFieldAgentCol } from 'nocodb-sdk'

/**
 * Shared field agent logic for select cell editors (Single/MultiSelect).
 * Provides: isFieldAgent, rowPk, isAiGenerating, runFieldAgent.
 */
export function useFieldAgentCell({
  column,
  meta,
  emit,
}: {
  column: Ref<ColumnType>
  meta: Ref<any>
  emit: (event: 'update:modelValue', value: any) => void
}) {
  const smartsheetRowStore = useSmartsheetRowStore()
  const { generateRows, generatingRows, generatingColumnRows, isAiFeaturesEnabled, aiIntegrationAvailable } = useNocoAi()
  const { showUpgradeToUseFieldAgent } = useEeConfig()

  const isFieldAgent = computed(() => {
    return isAiFeaturesEnabled.value && aiIntegrationAvailable.value && isFieldAgentCol(column.value)
  })

  const rowPk = computed(() => {
    if (!smartsheetRowStore?.currentRow?.value?.row || !meta.value?.columns) return null
    return extractPkFromRow(smartsheetRowStore.currentRow.value.row, meta.value.columns as ColumnType[])
  })

  const isAiGenerating = computed(() => {
    if (!rowPk.value || !column.value?.id) return false
    return generatingRows.value.includes(rowPk.value) && generatingColumnRows.value.includes(column.value.id)
  })

  const runFieldAgent = async () => {
    if (!meta.value?.id || !column.value?.id || !rowPk.value) return
    if (isAiGenerating.value) return
    if (showUpgradeToUseFieldAgent()) return

    generatingRows.value.push(rowPk.value)
    generatingColumnRows.value.push(column.value.id)

    try {
      const res = await generateRows(meta.value.id, column.value.id, [rowPk.value])

      if (res?.length) {
        const value = res[0]?.[column.value.title!]
        emit('update:modelValue', value ?? null)

        if (smartsheetRowStore?.currentRow?.value?.row) {
          smartsheetRowStore.changedColumns.value.add(column.value.title!)
          smartsheetRowStore.currentRow.value.row[column.value.title!] = value
        }
      }
    } finally {
      generatingRows.value = generatingRows.value.filter((id) => id !== rowPk.value)
      generatingColumnRows.value = generatingColumnRows.value.filter((id) => id !== column.value?.id)
    }
  }

  return {
    isFieldAgent,
    rowPk,
    isAiGenerating,
    runFieldAgent,
  }
}
