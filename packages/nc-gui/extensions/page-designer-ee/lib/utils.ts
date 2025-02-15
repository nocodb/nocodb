import { type ColumnType, UITypes } from 'nocodb-sdk'

const linkedFields = [UITypes.Links]
export function isLinkedField(field: ColumnType) {
  return linkedFields.includes(field.uidt as UITypes)
}
