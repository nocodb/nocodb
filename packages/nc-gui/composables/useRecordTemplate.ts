import type { ColumnType, RecordTemplateType } from 'nocodb-sdk'
import type { GetMetaParams } from '~/composables/useMetas'

export const useRecordTemplate = createSharedComposable(() => {
  const showRecordTemplateManager = ref(false)
  const templates = ref<RecordTemplateType[]>([])
  const isLoadingTemplates = ref(false)
  const selectedTemplateId = ref<string | null>(null)
  const openManager = () => {}
  const loadTemplates = async () => {}
  const selectedTemplate = computed(() => null)
  const setSelectedTemplate = (_templateId: string | null) => {}

  return {
    showRecordTemplateManager,
    templates,
    isLoadingTemplates,
    loadTemplates,
    openManager,
    selectedTemplate,
    selectedTemplateId,
    setSelectedTemplate,
  }
})

export function parseRecordTemplateData(_tmpl: { template_data: Record<string, any> | string }): {
  fields: Record<string, any>
  ltarState: Record<string, any>
} {
  return { fields: {}, ltarState: {} }
}

export function countBlueprintsInLtarState(_ltarState: Record<string, any>): number {
  return 0
}

export async function createRecordFromTemplate(_params: {
  tmpl: { id?: string; template_data: Record<string, any> | string }
  api: any
  baseId: string
  tableId: string
  columns: ColumnType[]
  getMeta: (params: GetMetaParams) => Promise<any>
}): Promise<void> {
  // No-op in CE
}

export async function resolveBlueprintsInLtarState(
  _ltarState: Record<string, any>,
  _columns: ColumnType[],
  _api: any,
  _baseId: string,
  _getMeta?: (params: GetMetaParams) => Promise<any>,
  _depth?: number,
): Promise<Record<string, any>> {
  return {}
}
