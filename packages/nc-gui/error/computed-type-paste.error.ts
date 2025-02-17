import { TypeConversionError } from './type-conversion.error'

export class ComputedTypePasteError extends TypeConversionError {
  constructor() {
    super('Paste operation is not supported on the active cell')
  }
}
