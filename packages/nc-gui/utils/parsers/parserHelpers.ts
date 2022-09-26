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
export const getCheckboxValue = (value: number) => {
  return value && aggBooleanOptions[value]
}

export const isMultiLineTextType = (values: [], col = null) => {
  return values.some(
    (r) => (getColVal(r, col) || '').toString().match(/[\r\n]/) || (getColVal(r, col) || '').toString().length > 255,
  )
}

export const extractMultiOrSingleSelectProps = (colData: []) => {
  const colProps: any = {}
  if (colData.some((v: any) => v && (v || '').toString().includes(','))) {
    let flattenedVals = colData.flatMap((v: any) =>
      v
        ? v
            .toString()
            .trim()
            .split(/\s*,\s*/)
        : [],
    )
    const uniqueVals = (flattenedVals = flattenedVals.filter(
      (v, i, arr) => i === arr.findIndex((v1) => v.toLowerCase() === v1.toLowerCase()),
    ))
    if (flattenedVals.length > uniqueVals.length && uniqueVals.length <= Math.ceil(flattenedVals.length / 2)) {
      colProps.uidt = UITypes.MultiSelect
      colProps.dtxp = `'${uniqueVals.join("','")}'`
    }
  } else {
    const uniqueVals = colData
      .map((v: any) => (v || '').toString().trim())
      .filter((v, i, arr) => i === arr.findIndex((v1) => v.toLowerCase() === v1.toLowerCase()))
    if (colData.length > uniqueVals.length && uniqueVals.length <= Math.ceil(colData.length / 2)) {
      colProps.uidt = UITypes.SingleSelect
      colProps.dtxp = `'${uniqueVals.join("','")}'`
    }
  }
  return colProps
}

export const isDecimalType = (colData: []) =>
  colData.some((v: any) => {
    return v && parseInt(v) !== +v
  })

export const isEmailType = (colData: []) =>
  !colData.some((v: any) => {
    return v && !validateEmail(v)
  })
export const isUrlType = (colData: []) =>
  !colData.some((v: any) => {
    return v && !isValidURL(v)
  })
