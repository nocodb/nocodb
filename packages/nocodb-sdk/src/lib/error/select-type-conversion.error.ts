import type { SuppressedError } from './suppressed.error'
import { TypeConversionError } from './type-conversion.error'

export class SelectTypeConversionError extends TypeConversionError implements SuppressedError {
  constructor(readonly value: string[], readonly missingOptions: string[]) {
    super('')
    this.isErrorSuppressed = true
  }

  isErrorSuppressed: boolean
}
