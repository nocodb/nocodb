import type { TableType, UnifiedMetaType } from 'nocodb-sdk'

export const validateFormulaGetMeta = (
  getMeta: (
    baseId: string,
    tableIdOrTitle: string,
    force?: boolean,
    skipIfCacheMiss?: boolean,
    disableError?: boolean,
    navigateOnNotFound?: boolean,
  ) => Promise<TableType | null>,
) => {
  return (async (context, { id }) => {
    return getMeta(context.base_id, id, false, false)
  }) as UnifiedMetaType.IGetModel
}
