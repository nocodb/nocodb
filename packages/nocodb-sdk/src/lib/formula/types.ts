import { FormulaDataTypes } from './enums';

export interface FormulaMeta {
  validation?: {
    args?: {
      min?: number;
      max?: number;
      rqd?: number;

      // array of allowed types when args types are not same
      // types should be in order of args
      type?: FormulaDataTypes | FormulaDataTypes[];
    };
    custom?: (args: FormulaDataTypes[], parseTree: any) => void;
  };
  description?: string;
  syntax?: string;
  examples?: string[];
  returnType?: ((args: any[]) => FormulaDataTypes) | FormulaDataTypes;
  docsUrl?: string;
}
