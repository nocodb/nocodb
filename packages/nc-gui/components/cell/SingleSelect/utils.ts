import type { SelectOptionType } from 'nocodb-sdk'
import tinycolor from 'tinycolor2'

export const useSingleSelect = () => {
  const column = inject(ColumnInj)!

  const isForm = inject(IsFormInj, ref(false))

  const isEditColumn = inject(EditColumnInj, ref(false))

  const options = computed<(SelectOptionType & { value: string })[]>(() => {
    if (column?.value.colOptions) {
      const opts = column.value.colOptions
        ? // todo: fix colOptions type, options does not exist as a property
          (column.value.colOptions as any).options.filter((el: SelectOptionType) => el.title !== '') || []
        : []
      for (const op of opts.filter((el: any) => el.order === null)) {
        op.title = op.title.replace(/^'/, '').replace(/'$/, '')
      }

      let order = 1
      const limitOptionsById =
        ((parseProp(column.value.meta)?.limitOptions || []).reduce(
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

      if (
        !isEditColumn.value &&
        isForm.value &&
        parseProp(column.value.meta)?.isLimitOption &&
        (parseProp(column.value.meta)?.limitOptions || []).length
      ) {
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
  })

  const getOptionTextColor = (color?: string | null) => {
    color = color ?? '#ccc' // Set default only if color is null or undefined

    return tinycolor.isReadable(color, '#fff', { level: 'AA', size: 'large' })
      ? '#fff'
      : tinycolor.mostReadable(color, ['#0b1d05', '#fff']).toHex8String()
  }

  return { options, getOptionTextColor }
}
