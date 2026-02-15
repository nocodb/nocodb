import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'

const showRecordTemplateManager = ref(false)

// Shared reactive template list — mutated by the manager, read by menus
const templates = ref<any[]>([])

// Tracks the last-used template ID for the "New record" button default action
const selectedTemplateId = ref<string | null>(null)

export function useRecordTemplate() {
  const openManager = () => {
    showRecordTemplateManager.value = true
  }

  // The selected template object (resolved from ID against current templates list)
  const selectedTemplate = computed(() => {
    if (!selectedTemplateId.value) return null
    return templates.value.find((t) => t.id === selectedTemplateId.value && t.enabled !== false) || null
  })

  const setSelectedTemplate = (templateId: string | null) => {
    selectedTemplateId.value = templateId
  }

  return {
    showRecordTemplateManager,
    templates,
    openManager,
    selectedTemplate,
    selectedTemplateId,
    setSelectedTemplate,
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
  getMeta?: (baseId: string, tableId: string) => Promise<any>,
  depth: number = 0,
): Promise<Record<string, any>> {
  // Guard against infinite recursion (max 3 levels deep)
  if (depth > 3) return {}

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
          try {
            const created = await resolveSingleBlueprint(item, relatedTableId, api, baseId, getMeta, depth)
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
      try {
        const created = await resolveSingleBlueprint(linkedData, relatedTableId, api, baseId, getMeta, depth)
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

/**
 * Resolve a single blueprint record: if it has nested _ltarState, recursively resolve those first,
 * then create the record with resolved nested links.
 */
async function resolveSingleBlueprint(
  blueprint: Record<string, any>,
  relatedTableId: string,
  api: any,
  baseId: string,
  getMeta?: (baseId: string, tableId: string) => Promise<any>,
  depth: number = 0,
): Promise<any> {
  const { _isBlueprint, _ltarState, ...recordData } = blueprint

  // If this blueprint has nested blueprints, resolve them first
  if (_ltarState && Object.keys(_ltarState).length && getMeta) {
    const relatedMeta = await getMeta(baseId, relatedTableId)
    const relatedColumns = relatedMeta?.columns || []
    const resolvedNestedState = await resolveBlueprintsInLtarState(
      _ltarState,
      relatedColumns,
      api,
      baseId,
      getMeta,
      depth + 1,
    )
    // Merge resolved nested links into the record data
    Object.assign(recordData, resolvedNestedState)
  }

  return await api.dbTableRow.create('noco', baseId, relatedTableId, recordData)
}
