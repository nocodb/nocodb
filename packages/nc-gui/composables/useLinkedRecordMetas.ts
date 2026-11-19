import type { TableType } from 'nocodb-sdk'
import { ensureLinkedRecordMetas } from '~/utils/linkedRecordDisplay'

// Requests the hop metas a record's link display chain needs (not in shared views); `metas` fills in reactively
export function useLinkedRecordMetas() {
  const { metas, getMeta, getMetaByKey } = useMetas()
  const isPublic = inject(IsPublicInj, ref(false))

  const ensureLinkedMetas = (
    record: Record<string, any> | null | undefined,
    meta: TableType | undefined,
    overrideColumnId?: string | null,
  ) => {
    // shared views get their metas from the payload; the meta API is not open to them
    if (isPublic.value) return Promise.resolve()

    return ensureLinkedRecordMetas(
      record,
      meta,
      {
        getMetas: () => metas.value,
        loadMeta: async (baseId, tableId) => {
          await getMeta({ baseId, tableIdOrTitle: tableId, disableError: true })
          return getMetaByKey(baseId, tableId)
        },
      },
      overrideColumnId,
    )
  }

  return { ensureLinkedMetas }
}
