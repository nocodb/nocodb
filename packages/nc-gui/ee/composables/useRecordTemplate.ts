import type { ColumnType, LinkToAnotherRecordType, RecordTemplateType } from 'nocodb-sdk'

// ──────────────────────────────────────────────────────────────────────────────
// Composable (shared singleton via createSharedComposable)
// ──────────────────────────────────────────────────────────────────────────────

export const useRecordTemplate = createSharedComposable(() => {
  /** Controls visibility of the "Manage Templates" modal */
  const showRecordTemplateManager = ref(false)

  /**
   * Shared reactive template list.
   * Populated by RecordTemplatesButton (manager), consumed by AddNewRowMenu and canvas grid.
   * Contains all templates across all tables in the current base.
   */
  const templates = ref<RecordTemplateType[]>([])

  /** Tracks the last-used template ID for the "+" button's default action */
  const selectedTemplateId = ref<string | null>(null)

  const openManager = () => {
    showRecordTemplateManager.value = true
  }

  /** Resolved template object from selectedTemplateId (only if enabled) */
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
})

// ──────────────────────────────────────────────────────────────────────────────
// Pure utility functions (no Vue reactivity dependencies)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Parse a record template's `template_data` JSON into its constituent parts.
 *
 * @returns `fields` — column name → default value mapping
 * @returns `ltarState` — LTAR column title → linked record(s) or blueprint(s)
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
 * Count the total number of blueprint sub-records in an ltarState object.
 * Only counts items marked with `_isBlueprint` (new records to be created),
 * skipping links to existing records. Recurses through nested `_ltarState`.
 *
 * Used by the "Sub Records" column in the manage templates table.
 */
export function countBlueprintsInLtarState(ltarState: Record<string, any>): number {
  let count = 0
  for (const linkedData of Object.values(ltarState)) {
    if (Array.isArray(linkedData)) {
      // HM or MM — array of linked items
      for (const item of linkedData) {
        if (item?._isBlueprint) {
          count++
          if (item._ltarState && typeof item._ltarState === 'object') {
            count += countBlueprintsInLtarState(item._ltarState)
          }
        }
      }
    } else if (linkedData?._isBlueprint) {
      // BT or OO — single linked item
      count++
      if (linkedData._ltarState && typeof linkedData._ltarState === 'object') {
        count += countBlueprintsInLtarState(linkedData._ltarState)
      }
    }
  }
  return count
}

// ──────────────────────────────────────────────────────────────────────────────
// Template usage: create a real record from a template
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Create a new record from a template.
 *
 * This is the shared "use template" logic consumed by:
 *   - RecordTemplatesButton (manage modal "+" action)
 *   - AddNewRowMenu (dropdown template items)
 *   - Canvas grid (selected template "+" button click)
 *
 * Steps:
 *   1. Parse template_data into fields and ltarState
 *   2. Resolve blueprints — recursively create real records for sub-record blueprints
 *   3. Create the main record with resolved LTAR links
 *   4. Increment the template's usage counter (non-critical)
 */
export async function createRecordFromTemplate(params: {
  tmpl: { id?: string; template_data: Record<string, any> | string }
  api: any
  baseId: string
  tableId: string
  columns: ColumnType[]
  getMeta: (baseId: string, tableId: string) => Promise<any>
}): Promise<void> {
  const { tmpl, api, baseId, tableId, columns, getMeta } = params

  // Step 1: Parse template data
  const { fields, ltarState } = parseRecordTemplateData(tmpl)

  // Step 2: Resolve blueprint sub-records into real records
  const resolvedLtarState = await resolveBlueprintsInLtarState(ltarState, columns, api, baseId, getMeta)

  // Step 3: Create the main record
  await api.dbTableRow.create('noco', baseId, tableId, {
    ...fields,
    ...resolvedLtarState,
  })

  // Step 4: Increment usage count (fire-and-forget; non-critical)
  if (tmpl.id) {
    try {
      await api.recordTemplates.recordTemplateUse(baseId, tmpl.id)
    } catch {
      // Usage count increment failure is non-critical
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Blueprint resolution (internal to template usage)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Resolve blueprint records in an ltarState object.
 *
 * Blueprints are placeholder records stored in template_data with `_isBlueprint: true`.
 * When a template is "used", each blueprint is created as a real record in its linked table,
 * and the ltarState is returned with blueprints replaced by the created records.
 *
 * Supports up to 3 levels of nesting (e.g., Project → Tasks → Sub-tasks).
 * Existing record links (without `_isBlueprint`) are passed through unchanged.
 *
 * @param ltarState   - LTAR column title → linked record(s) mapping
 * @param columns     - Column definitions for the current table (to resolve LTAR → related table ID)
 * @param api         - NocoDB API client
 * @param baseId      - Current base ID
 * @param getMeta     - Async function to fetch table metadata (for nested resolution)
 * @param depth       - Current recursion depth (internal, starts at 0)
 */
export async function resolveBlueprintsInLtarState(
  ltarState: Record<string, any>,
  columns: ColumnType[],
  api: any,
  baseId: string,
  getMeta?: (baseId: string, tableId: string) => Promise<any>,
  depth: number = 0,
): Promise<Record<string, any>> {
  if (depth > 3) return {}

  const resolvedState: Record<string, any> = {}

  for (const [colTitle, linkedData] of Object.entries(ltarState)) {
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
          // Existing record link — pass through unchanged
          resolvedItems.push(item)
        }
      }
      resolvedState[colTitle] = resolvedItems
    } else if (linkedData?._isBlueprint) {
      // BT or OO — single blueprint record
      try {
        const created = await resolveSingleBlueprint(linkedData, relatedTableId, api, baseId, getMeta, depth)
        resolvedState[colTitle] = created
      } catch (e: any) {
        console.error(`Failed to create blueprint record in table ${relatedTableId}:`, e)
      }
    } else {
      // Existing record link — pass through unchanged
      resolvedState[colTitle] = linkedData
    }
  }

  return resolvedState
}

/**
 * Resolve a single blueprint into a real record.
 *
 * If the blueprint contains nested `_ltarState` (sub-blueprints), those are
 * resolved recursively first, then the record is created with all nested links.
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

  // Recursively resolve nested blueprints before creating this record
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
    Object.assign(recordData, resolvedNestedState)
  }

  return await api.dbTableRow.create('noco', baseId, relatedTableId, recordData)
}
