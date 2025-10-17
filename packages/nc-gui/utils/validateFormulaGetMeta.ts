import type { TableType, UnifiedMetaType } from 'nocodb-sdk'

export const validateFormulaGetMeta = (
  getMeta: (
    tableIdOrTitle: string,
    force?: boolean,
    skipIfCacheMiss?: boolean,
    baseId?: string,
    disableError?: boolean,
    navigateOnNotFound?: boolean,
  ) => Promise<TableType | null>,
) => {
  return (async (context, { id }) => {
    return getMeta(id, false, false, context.base_id)
  }) as UnifiedMetaType.IGetModel
}
