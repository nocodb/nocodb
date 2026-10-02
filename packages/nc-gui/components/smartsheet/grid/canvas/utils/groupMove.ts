import { UITypes, isLinksOrLTAR, isReadonlyVirtualColumn, isSystemColumn } from 'nocodb-sdk'
import type { ColumnType } from 'nocodb-sdk'
import { GROUP_BY_VARS } from '../../../../../lib/constants'

export type GroupMoveBlockReason = 'readonly' | 'link' | 'dateTime' | 'permission' | 'required'

export interface GroupMoveLevel {
  title: string
  key: string
  column_id: string
}

export type GroupMoveResult =
  | { patch: Record<string, any>; changedLevel: number; blocked?: undefined }
  | { blocked: { column: ColumnType; reason: GroupMoveBlockReason } }

function getBlockReason(
  column: ColumnType,
  targetKey: string,
  canEditField: (column: ColumnType) => boolean,
): GroupMoveBlockReason | undefined {
  if (isLinksOrLTAR(column)) return 'link'
  // DateTime groups are bucketed by date only, so the target key can't rebuild the time.
  if (column.uidt === UITypes.DateTime) return 'dateTime'
  if (
    isReadonlyVirtualColumn(column) ||
    isSystemColumn(column) ||
    [UITypes.Barcode, UITypes.QrCode].includes(column.uidt as UITypes) ||
    column.pk ||
    column.ai ||
    column.readonly
  ) {
    return 'readonly'
  }
  if (!canEditField(column)) return 'permission'
  if (targetKey === GROUP_BY_VARS.NULL && column.rqd) return 'required'
}

function groupKeyToValue(column: ColumnType, key: string) {
  if (key === GROUP_BY_VARS.NULL) return null

  switch (column.uidt) {
    case UITypes.Checkbox:
      return key === GROUP_BY_VARS.TRUE
    case UITypes.User: {
      try {
        const users = JSON.parse(key)
        return (Array.isArray(users) ? users : [users]).map((u: { id: string }) => ({ id: u.id }))
      } catch {
        return key
      }
    }
    default:
      // MultiSelect keys are the full comma-joined set, so writing the key replaces the value.
      return key
  }
}

/**
 * Field values a record needs to move from one group path to another.
 * `target` may be shorter than `source` (drop on a collapsed parent group); deeper levels stay as they are.
 * Levels shared by both paths are never written, so a read-only field only blocks when its group changes.
 */
export function resolveGroupMove(
  source: GroupMoveLevel[],
  target: GroupMoveLevel[],
  columns: ColumnType[],
  canEditField: (column: ColumnType) => boolean,
): GroupMoveResult {
  const patch: Record<string, any> = {}
  let changedLevel = -1

  for (let level = 0; level < target.length; level++) {
    const targetLevel = target[level]!
    if (source[level]?.key === targetLevel.key) continue

    const column = columns.find((c) => c.id === targetLevel.column_id)
    if (!column) continue

    const reason = getBlockReason(column, targetLevel.key, canEditField)
    if (reason) return { blocked: { column, reason } }

    if (changedLevel === -1) changedLevel = level
    patch[column.title!] = groupKeyToValue(column, targetLevel.key)
  }

  return { patch, changedLevel }
}
