import type { UITypes } from 'nocodb-sdk'
import { TypeConversionError } from './type-conversion.error'

export class ComputedTypePasteError extends TypeConversionError {
  constructor(public readonly toUITypes: UITypes) {
    super("Can't paste into this field. The destination field is computed")
    this.isErrorSuppressed = false
  }
}
