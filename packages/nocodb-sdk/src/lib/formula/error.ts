import { FormulaErrorType } from './enums';

export class FormulaError extends Error {
  public type: FormulaErrorType;
  public extra: Record<string, any>;

  constructor(
    type: FormulaErrorType,
    extra: {
      [key: string]: any;
    },
    message: string = 'Formula Error'
  ) {
    super(message);
    this.type = type;
    this.extra = extra;
  }
}
