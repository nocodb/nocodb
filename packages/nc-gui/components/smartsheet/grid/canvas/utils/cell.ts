import { type ColumnType, type SelectOptionType, type SelectOptionsType, UITypes, timeFormats } from 'nocodb-sdk'

export const timeFormatsObj = {
  [timeFormats[0]]: 'hh:mm A',
  [timeFormats[1]]: 'hh:mm:ss A',
  [timeFormats[2]]: 'hh:mm:ss.SSS A',
}

export const timeCellMaxWidthMap = {
  [timeFormats[0]]: {
    12: 85,
    24: 65,
  },
  [timeFormats[1]]: {
    12: 100,
    24: 80,
  },
  [timeFormats[2]]: {
    12: 130,
    24: 110,
  },
}

export const getSingleMultiselectColOptions = (column: ColumnType) => {
  const colOptions: {
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

export const NO_EDITABLE_CELL = [UITypes.Rating, UITypes.Checkbox]
