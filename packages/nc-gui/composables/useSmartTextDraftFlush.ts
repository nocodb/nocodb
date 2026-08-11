import type { TableType } from 'nocodb-sdk'

/**
 * CE stub. SmartText is an EE-only feature, so in CE there are never any drafts
 * to flush — the EE overlay (`ee/composables/useSmartTextDraftFlush.ts`) provides
 * the real implementation that persists staged ProseMirror content to the backend.
 */
export function useSmartTextDraftFlush() {
  const flushSmartTextDrafts = async (
    _meta: TableType,
    _rowId: string,
    _drafts: Record<string, Record<string, any> | null>,
    _rowData?: Record<string, any>,
  ): Promise<Record<string, Record<string, any> | null>> => ({})

  return { flushSmartTextDrafts }
}
