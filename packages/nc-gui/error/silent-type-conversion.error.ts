import type { SuppressedError } from './suppressed.error'
import { TypeConversionError } from './type-conversion.error'

export class SilentTypeConversionError extends TypeConversionError implements SuppressedError {
  constructor() {
    super('')
    this.isErrorSuppressed = true
  }

  isErrorSuppressed: boolean
}
