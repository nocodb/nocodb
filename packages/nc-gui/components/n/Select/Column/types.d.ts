import type { ColumnType } from 'nocodb-sdk'
import type { NSelectProps } from '../types'

export interface NSelectColumnProps extends NSelectProps {
  tableId: string
  filterColumns?: (c: ColumnType) => boolean
  includeSystem?: boolean
}
