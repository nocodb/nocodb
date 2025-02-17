import { timeFormats, type ColumnType, type SelectOptionsType, type SelectOptionType } from 'nocodb-sdk'

export const timeFormatsObj = {
  [timeFormats[0]]: 'hh:mm A',
  [timeFormats[1]]: 'hh:mm:ss A',
  [timeFormats[2]]: 'hh:mm:ss.SSS A',
}

export const timeCellMaxWidthMap = {
  [timeFormats[0]]: {
    12: 'max-w-[85px]',
    24: 'max-w-[65px]',
  },
  [timeFormats[1]]: {
    12: 'max-w-[100px]',
    24: 'max-w-[80px]',
  },
  [timeFormats[2]]: {
    12: 'max-w-[130px]',
    24: 'max-w-[110px]',
  },
}

export const getSingleMultiselectColOptions = (column: ColumnType) => {
  let colOptions: {
    options: (SelectOptionType & { value: string })[]
    optionsMap: Record<string, SelectOptionType & { value: string }>
  } = {
    options: [],
    optionsMap: {},
  }

  const selectColOptions = column.colOptions as SelectOptionsType

  if (!selectColOptions || !ncIsArray(selectColOptions.options)) return colOptions

  colOptions.options = selectColOptions.options
    .filter((op) => op.title !== '')
    .map((op) => {
      if (op.order !== null) {
        op.title = op.title?.replace(/^'/, '').replace(/'$/, '')
      }

      op.value = op.title

      return op
    }) as (SelectOptionType & { value: string })[]

  colOptions.optionsMap = colOptions.options.reduce((acc, op) => {
    if (op.title) {
      acc[op.title.trim()] = op
    }
    return acc
  }, {} as Record<string, (typeof colOptions.options)[number]>)

  return colOptions
}
