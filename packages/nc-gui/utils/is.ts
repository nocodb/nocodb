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

function ncIsPlaywright() {
  return !!(window as any)?.isPlaywright
}

function ncIsSharedViewOrBase() {
  // Use sessionStorage instead of localStorage to make it tab-specific
  return sessionStorage.getItem('ncIsSharedViewOrBase') === 'true'
}

export {
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
  ncIsPlaywright,
  ncIsPromise,
  ncIsSharedViewOrBase,
  ncIsString,
  ncIsUndefined,
}
