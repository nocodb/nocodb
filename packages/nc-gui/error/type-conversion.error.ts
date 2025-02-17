import type { SuppressedError } from './suppressed.error'

export class TypeConversionError extends TypeError implements SuppressedError {
  constructor(message: string) {
    super(message)
    this.isErrorSuppressed = true
  }

  isErrorSuppressed: boolean
}
