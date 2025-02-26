import type { Api, ColumnType, SelectOptionType, SelectOptionsType } from 'nocodb-sdk'
import { enumColors } from 'nocodb-sdk'

export const appendSelectOptions = async (params: {
  api: Api<any>
  col: ColumnType
  addOptions: string[] | SelectOptionType[]
}) => {
  if (!params.addOptions || params.addOptions.length === 0) {
    return
  }

  if (!params.col.colOptions) {
    params.col.colOptions = {
      options: [],
    } as SelectOptionsType
  }
  const existingOptionsLength = (params.col.colOptions as SelectOptionsType).options.length ?? 0
  const optionsToAdd =
    typeof params.addOptions[0] === 'string'
      ? params.addOptions.map((k, i) => {
          return {
            fk_column_id: params.col.id,
            title: k,
            order: existingOptionsLength + i + 1,
            color: enumColors.light[(existingOptionsLength + i) % enumColors.light.length],
          } as SelectOptionType
        })
      : (params.addOptions as SelectOptionType[])

  ;(params.col.colOptions as SelectOptionsType).options = [
    ...(params.col.colOptions as SelectOptionsType).options,
    ...optionsToAdd,
  ]
  await params.api.dbTableColumn.update(params.col.id!, params.col as any)
}
