import type { ColumnType, SelectOptionType, SelectOptionsType } from 'nocodb-sdk'

export type LocalSelectOptionType = SelectOptionType & { value?: string }

export type SelectInputOptionType = { label: string; value: string } & SelectOptionType

export const getOptions = (column: ColumnType, isEditColumn: boolean, isForm: boolean) => {
  if (column && column?.colOptions) {
    const opts = column.colOptions
      ? (column.colOptions as SelectOptionsType).options.filter((el: SelectOptionType) => el.title !== '') || []
      : []

    for (const op of opts.filter((el: SelectOptionType) => el.order === null)) {
      op.title = op.title?.replace(/^'/, '').replace(/'$/, '')
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
        .filter((o: SelectOptionType) => {
          if (limitOptionsById[o.id!]?.show !== undefined) {
            return limitOptionsById[o.id!]?.show
          }
          return false
        })
        .map((o) => ({
          ...o,
          value: o.title,
          order: o.id && limitOptionsById[o.id] ? limitOptionsById[o.id]?.order : order++,
        }))
        .sort((a, b) => a.order - b.order)
    } else {
      return opts.map((o: SelectOptionType) => ({ ...o, value: o.title }))
    }
  }
  return []
}

export const getSelectedTitles = (
  column: ColumnType,
  optionsMap: Record<string, LocalSelectOptionType>,
  isMysql: (sourceId?: string) => boolean,
  modelValue?: string | string[],
) => {
  return modelValue
    ? Array.isArray(modelValue)
      ? modelValue
      : isMysql(column.source_id)
      ? modelValue
          .toString()
          .split(',')
          .sort((a, b) => {
            const opa = optionsMap[a?.trim()]
            const opb = optionsMap[b?.trim()]
            if (opa && opb) {
              return opa.order! - opb.order!
            }
            return 0
          })
      : modelValue.toString().split(',')
    : []
}
