import { UITypes, type ColumnType } from 'nocodb-sdk'
import { isUniqueConstraintSupportedType, canEnableUniqueConstraint as checkCanEnableUniqueConstraint } from '~/utils/uniqueConstraintHelpers'

export function useUniqueConstraintHelpers() {
  return {
    isUniqueConstraintSupportedType,
    canEnableUniqueConstraint: (column: ColumnType, isXcdbBase: boolean) =>
      checkCanEnableUniqueConstraint(column, isXcdbBase),
  }
}


