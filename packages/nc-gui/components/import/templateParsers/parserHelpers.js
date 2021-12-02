const booleanOptions = [
  { checked: true, unchecked: false },
  { x: true, '': false },
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
  { done: true, '': false }
]
const aggBooleanOptions = booleanOptions.reduce((obj, o) => ({ ...obj, ...o }), {})
export const isCheckboxType = (values, col = '') => {
  let options = booleanOptions
  for (let i = 0; i < values.length; i++) {
    let val = col ? values[i][col] : values[i]
    val = val === null || val === undefined ? '' : val
    options = options.filter(v => val in v)
    if (!options.length) {
      return false
    }
  }
  return options
}
export const getCheckboxValue = (value) => {
  return value && aggBooleanOptions[value]
}
