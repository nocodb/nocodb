import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'

const showRecordTemplateManager = ref(false)

// Shared reactive template list — mutated by the manager, read by menus
const templates = ref<any[]>([])

export function useRecordTemplate() {
  const openManager = () => {
    showRecordTemplateManager.value = true
  }

  return {
    showRecordTemplateManager,
    templates,
    openManager,
  }
}

/**
 * Parse template_data from a record template into fields and ltarState.
 */
export function parseRecordTemplateData(tmpl: { template_data: Record<string, any> | string }): {
  fields: Record<string, any>
  ltarState: Record<string, any>
} {
  const data = typeof tmpl.template_data === 'string' ? JSON.parse(tmpl.template_data) : tmpl.template_data || {}
  return {
    fields: data.fields || {},
    ltarState: data.ltarState || {},
  }
}

/**
 * Resolve blueprint records in ltarState.
 * Creates real records in linked tables for items marked with _isBlueprint,
 * then returns a new ltarState with those replaced by the created records.
 */
export async function resolveBlueprintsInLtarState(
  ltarState: Record<string, any>,
  columns: ColumnType[],
  api: any,
  baseId: string,
): Promise<Record<string, any>> {
  const resolvedState: Record<string, any> = {}

  for (const [colTitle, linkedData] of Object.entries(ltarState)) {
    // Find the LTAR column by title to get the related table ID
    const column = columns.find((c: ColumnType) => c.title === colTitle)
    if (!column) {
      resolvedState[colTitle] = linkedData
      continue
    }

    const colOptions = column.colOptions as LinkToAnotherRecordType
    const relatedTableId = colOptions?.fk_related_model_id

    if (!relatedTableId) {
      resolvedState[colTitle] = linkedData
      continue
    }

    if (Array.isArray(linkedData)) {
      // HM or MM — array of linked records
      const resolvedItems = []
      for (const item of linkedData) {
        if (item?._isBlueprint) {
          const { _isBlueprint, ...recordData } = item
          try {
            const created = await api.dbTableRow.create('noco', baseId, relatedTableId, recordData)
            resolvedItems.push(created)
          } catch (e: any) {
            console.error(`Failed to create blueprint record in table ${relatedTableId}:`, e)
          }
        } else {
          resolvedItems.push(item)
        }
      }
      resolvedState[colTitle] = resolvedItems
    } else if (linkedData?._isBlueprint) {
      // BT or OO — single linked record
      const { _isBlueprint, ...recordData } = linkedData
      try {
        const created = await api.dbTableRow.create('noco', baseId, relatedTableId, recordData)
        resolvedState[colTitle] = created
      } catch (e: any) {
        console.error(`Failed to create blueprint record in table ${relatedTableId}:`, e)
      }
    } else {
      resolvedState[colTitle] = linkedData
    }
  }

  return resolvedState
}
