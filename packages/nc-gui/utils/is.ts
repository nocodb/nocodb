import {
  ncIsArray,
  ncIsArrayIncludes,
  ncIsBoolean,
  ncIsEmptyArray,
  ncIsEmptyObject,
  ncIsFunction,
  ncIsNull,
  ncIsNullOrUndefined,
  ncIsNumber,
  ncIsObject,
  ncIsPromise,
  ncIsString,
  ncIsUndefined,
} from 'nocodb-sdk'

const ncIsPlaywright = () => {
  return !!(window as any)?.isPlaywright
}

const ncIsSharedViewOrBase = () => {
  // Use sessionStorage instead of localStorage to make it tab-specific
  return sessionStorage.getItem('ncIsSharedViewOrBase') === 'true' || localStorage.getItem('ncIsSharedViewOrBase') === 'true'
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
  ncIsSharedViewOrBase,
  ncIsNullOrUndefined,
}
