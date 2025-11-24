import { type ColumnType, UITypes } from 'nocodb-sdk'
import {
  canEnableUniqueConstraint as checkCanEnableUniqueConstraint,
  isUniqueConstraintSupportedType,
} from '~/utils/uniqueConstraintHelpers'

export function useUniqueConstraintHelpers() {
  return {
    isUniqueConstraintSupportedType,
    canEnableUniqueConstraint: (column: ColumnType, isXcdbBase: boolean) => checkCanEnableUniqueConstraint(column, isXcdbBase),
  }
}
