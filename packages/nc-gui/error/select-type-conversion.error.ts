import { TypeConversionError } from './type-conversion.error'

export class SelectTypeConversionError extends TypeConversionError {
  constructor(message: string) {
    super(message)
  }
}
