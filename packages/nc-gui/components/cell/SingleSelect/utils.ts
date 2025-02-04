import type { ColumnType, SelectOptionType } from 'nocodb-sdk'

export const getOptions = (
  column: ColumnType,
  isEditColumn: boolean,
  isForm: boolean,
): (SelectOptionType & { value?: string })[] => {
  if (column && column?.colOptions) {
    const opts = column.colOptions
      ? // todo: fix colOptions type, options does not exist as a property
        (column.colOptions as any).options.filter((el: SelectOptionType) => el.title !== '') || []
      : []

    for (const op of opts.filter((el: any) => el.order === null)) {
      op.title = op.title.replace(/^'/, '').replace(/'$/, '')
    }

    let order = 1

    const limitOptionsById =
      ((parseProp(column.meta)?.limitOptions || []).reduce(
        (o: Record<string, FormFieldsLimitOptionsType>, f: FormFieldsLimitOptionsType) => {
          if (order < (f?.order ?? 0)) {
            order = f.order
          }
          return {
            ...o,
            [f.id]: f,
          }
        },
        {},
      ) as Record<string, FormFieldsLimitOptionsType>) ?? {}

    if (!isEditColumn && isForm && parseProp(column.meta)?.isLimitOption && (parseProp(column.meta)?.limitOptions || []).length) {
      return opts
        .filter((o: SelectOptionType & { value: string }) => {
          if (limitOptionsById[o.id]?.show !== undefined) {
            return limitOptionsById[o.id]?.show
          }
          return false
        })
        .map((o: any) => ({
          ...o,
          value: o.title,
          order: o.id && limitOptionsById[o.id] ? limitOptionsById[o.id]?.order : order++,
        }))
        .sort((a, b) => a.order - b.order)
    } else {
      return opts.map((o: any) => ({ ...o, value: o.title }))
    }
  }
  return []
}
