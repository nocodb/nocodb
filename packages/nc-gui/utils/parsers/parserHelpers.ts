import { UITypes } from 'nocodb-sdk'
import { isValidURL } from '~/utils/urlUtils'
import { validateEmail } from '~/utils/validation'

const booleanOptions = [
  { checked: true, unchecked: false },
  { 'x': true, '': false },
  { yes: true, no: false },
  { y: true, n: false },
  { 1: true, 0: false },
  { '[x]': true, '[]': false, '[ ]': false },
  { '☑': true, '': false },
  { '✅': true, '': false },
  { '✓': true, '': false },
  { '✔': true, '': false },
  { enabled: true, disabled: false },
  { on: true, off: false },
  { 'done': true, '': false },
  { true: true, false: false },
]
const aggBooleanOptions: any = booleanOptions.reduce((obj, o) => ({ ...obj, ...o }), {})

const getColVal = (row: any, col = null) => {
  return row && col ? row[col] : row
}

export const isCheckboxType: any = (values: [], col = null) => {
  let options = booleanOptions
  for (let i = 0; i < values.length; i++) {
    const val = getColVal(values[i], col)

    if (val === null || val === undefined || val.toString().trim() === '') {
      continue
    }

    options = options.filter((v) => val in v)
    if (!options.length) {
      return false
    }
  }
  return options
}

export const getCheckboxValue = (value: any) => {
  return value && aggBooleanOptions[value]
}

export const isMultiLineTextType = (values: [], col = null) => {
  return values.some(
    (r) => (getColVal(r, col) || '').toString().match(/[\r\n]/) || (getColVal(r, col) || '').toString().length > 255,
  )
}

export const extractMultiOrSingleSelectProps = (colData: []) => {
  const maxSelectOptionsAllowed = 64
  const colProps: any = {}
  if (colData.some((v: any) => v && (v || '').toString().includes(','))) {
    const flattenedVals = colData.flatMap((v: any) =>
      v
        ? v
            .toString()
            .trim()
            .split(/\s*,\s*/)
        : [],
    )

    const uniqueVals = [...new Set(flattenedVals.map((v: any) => v.toString().trim().toLowerCase()))]

    if (uniqueVals.length > maxSelectOptionsAllowed) {
      // too many options are detected, convert the column to SingleLineText instead
      colProps.uidt = UITypes.SingleLineText
      // _disableSelect is used to disable the <a-select-option/> in TemplateEditor
      colProps._disableSelect = true
    } else {
      // assume the column type is multiple select if there are repeated values
      if (flattenedVals.length > uniqueVals.length && uniqueVals.length <= Math.ceil(flattenedVals.length / 2)) {
        colProps.uidt = UITypes.MultiSelect
      }
      // set dtxp here so that users can have the options even they switch the type from other types to MultiSelect
      // once it's set, dtxp needs to be reset if the final column type is not MultiSelect
      colProps.dtxp = `${uniqueVals.map((v) => `'${v.replace(/'/gi, "''")}'`).join(',')}`
    }
  } else {
    const uniqueVals = [...new Set(colData.map((v: any) => v.toString().trim().toLowerCase()))]

    if (uniqueVals.length > maxSelectOptionsAllowed) {
      // too many options are detected, convert the column to SingleLineText instead
      colProps.uidt = UITypes.SingleLineText
      // _disableSelect is used to disable the <a-select-option/> in TemplateEditor
      colProps._disableSelect = true
    } else {
      // assume the column type is single select if there are repeated values
      // once it's set, dtxp needs to be reset if the final column type is not Single Select
      if (colData.length > uniqueVals.length && uniqueVals.length <= Math.ceil(colData.length / 2)) {
        colProps.uidt = UITypes.SingleSelect
      }
      // set dtxp here so that users can have the options even they switch the type from other types to SingleSelect
      // once it's set, dtxp needs to be reset if the final column type is not SingleSelect
      colProps.dtxp = `${uniqueVals.map((v) => `'${v.replace(/'/gi, "''")}'`).join(',')}`
    }
    return colProps
  }
}

export const isDecimalType = (colData: []) =>
  colData.some((v: any) => {
    return v && parseInt(v) !== +v
  })

export const isEmailType = (colData: []) =>
  colData.some((v: any) => {
    return v && validateEmail(v)
  })

export const isUrlType = (colData: []) =>
  colData.some((v: any) => {
    return v && isValidURL(v)
  })

export const getColumnUIDTAndMetas = (colData: [], defaultType: string) => {
  const colProps = { uidt: defaultType }

  if (colProps.uidt === UITypes.SingleLineText) {
    // check for long text
    if (isMultiLineTextType(colData)) {
      colProps.uidt = UITypes.LongText
    }
    if (isEmailType(colData)) {
      colProps.uidt = UITypes.Email
    }
    if (isUrlType(colData)) {
      colProps.uidt = UITypes.URL
    } else {
      const checkboxType = isCheckboxType(colData)
      if (checkboxType.length === 1) {
        colProps.uidt = UITypes.Checkbox
      } else {
        Object.assign(colProps, extractMultiOrSingleSelectProps(colData))
      }
    }
  } else if (colProps.uidt === UITypes.Number) {
    if (isDecimalType(colData)) {
      colProps.uidt = UITypes.Decimal
    }
  }
  // TODO(import): currency
  // TODO(import): date / datetime
  return colProps
}
