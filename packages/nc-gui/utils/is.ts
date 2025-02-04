import {
  ncIsArray,
  ncIsArrayIncludes,
  ncIsBoolean,
  ncIsEmptyArray,
  ncIsEmptyObject,
  ncIsFunction,
  ncIsNull,
  ncIsNumber,
  ncIsObject,
  ncIsPromise,
  ncIsString,
  ncIsUndefined,
} from 'nocodb-sdk'

const ncIsPlaywright = () => {
  return !!(window as any)?.isPlaywright
}

export {
  ncIsObject,
  ncIsEmptyObject,
  ncIsArray,
  ncIsEmptyArray,
  ncIsString,
  ncIsNumber,
  ncIsBoolean,
  ncIsUndefined,
  ncIsNull,
  ncIsFunction,
  ncIsPromise,
  ncIsArrayIncludes,
  ncIsPlaywright,
}
