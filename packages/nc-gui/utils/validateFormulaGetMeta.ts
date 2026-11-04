import type { TableType, UnifiedMetaType } from 'nocodb-sdk'
import type { GetMetaParams } from '~/composables/useMetas'

export const validateFormulaGetMeta = (getMeta: (params: GetMetaParams) => Promise<TableType | null>) => {
  return (async (context, { id }) => {
    return getMeta({ baseId: context.base_id, tableIdOrTitle: id })
  }) as UnifiedMetaType.IGetModel
}
