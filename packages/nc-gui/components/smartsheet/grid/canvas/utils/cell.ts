import JsBarcode from 'jsbarcode'
import {
  type ColumnType,
  type SelectOptionType,
  type SelectOptionsType,
  UITypes,
  type UserFieldRecordType,
  type UserType,
  timeFormats,
} from 'nocodb-sdk'
import { LRUCache } from 'lru-cache'
import { getI18n } from '../../../../../plugins/a.i18n'

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

export const EDIT_CELL_REDUCTION = {
  1: 0,
  2: 28,
  4: 58,
  6: 88,
} as const

export const parseCellWidth = (width?: string | number) => {
  if (typeof width === 'number') return width
  return width ? parseInt(width.replace('px', ''), 10) : 180
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

export const getUserColOptions = (column: ColumnType, baseUsers: (Partial<UserType> | Partial<User>)[]) => {
  const colOptions: {
    options: UserFieldRecordType[]
    optionsMap: Record<string, UserFieldRecordType>
  } = {
    options: [],
    optionsMap: {},
  }

  let order = 1
  colOptions.options.push(
    ...(baseUsers || [])
      .map((user: any) => ({
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        deleted: user.deleted,
        order: order++,
        meta: user.meta,
      }))
      .sort((a, b) => a.order - b.order),
  )

  colOptions.optionsMap = colOptions.options.reduce((acc, op) => {
    if (op.id) {
      acc[op.id] = op
    }
    if (op.email) {
      acc[op.email.trim()] = op
    }
    return acc
  }, {} as Record<string, UserFieldRecordType>)

  return colOptions
}

export const NO_EDITABLE_CELL = [
  UITypes.Rating,
  UITypes.Checkbox,
  UITypes.ID,
  UITypes.Rollup,
  UITypes.CreatedBy,
  UITypes.LastModifiedBy,
  UITypes.LastModifiedTime,
  UITypes.CreatedTime,
  UITypes.Formula,
]

export const renderAsCellLookupOrLtarValue = [
  UITypes.SingleSelect,
  UITypes.MultiSelect,
  UITypes.User,
  UITypes.CreatedBy,
  UITypes.LastModifiedBy,
  UITypes.Checkbox,
  UITypes.Attachment,
  UITypes.Rating,
  UITypes.QrCode,
  UITypes.Barcode,
  UITypes.Lookup,
]

export const MouseClickType = {
  SINGLE_CLICK: 1,
  DOUBLE_CLICK: 2,
  RIGHT_CLICK: 'right',
} as const

export function getMouseClickType(e: MouseEvent) {
  if (e.button === 2) return MouseClickType.RIGHT_CLICK

  if (e.ctrlKey && e.button === 0 && e.detail === 1) {
    return MouseClickType.RIGHT_CLICK
  }

  if (e.button === 0) {
    return e.detail === 1 ? MouseClickType.SINGLE_CLICK : MouseClickType.DOUBLE_CLICK
  }

  return null
}

export const showFieldEditWarning = () => {
  const { t } = getI18n().global
  message.warn(t('msg.info.computedFieldEditWarning'))
}

const barcodeCache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 60,
})

export const validateBarcode = (value: string, column: ColumnType): { isValid: boolean; format: string } => {
  if (!value) return { isValid: false, format: '' }

  const meta = parseProp(column?.meta)
  const format = meta.barcodeFormat || 'CODE128'

  const cacheKey = `${value}-${format}`

  const cachedResult = barcodeCache.get(cacheKey)
  if (cachedResult !== undefined) {
    return cachedResult as { isValid: boolean; format: string }
  }

  try {
    const tempCanvas = document.createElement('canvas')

    JsBarcode(tempCanvas, value.toString(), {
      format,
      displayValue: false,
      lineColor: '#000000',
      margin: 0,
    })

    const result = { isValid: true, format }
    barcodeCache.set(cacheKey, result)
    return result
  } catch (error) {
    const result = { isValid: false, format }
    barcodeCache.set(cacheKey, result)
    return result
  }
}
