import { TypeConversionError } from './type-conversion.error'

export class ComputedTypePasteError extends TypeConversionError {
  constructor() {
    super("Can't paste into this field. The destination field is computed")
  }
}
