import { GqlApiBuilder } from '../../v1-legacy/gql/GqlApiBuilder';
import { RestApiBuilder } from '../../v1-legacy/rest/RestApiBuilder';

import XcProcedure from './XcProcedure';

export default class BaseProcedure {
  protected builder: GqlApiBuilder | RestApiBuilder;
  protected procedures: any[];
  protected functions: any[];
  protected xcProcedure: XcProcedure;

  public functionsSet(functions): void {
    this.functions = functions;
  }

  public proceduresSet(procedures): void {
    this.procedures = procedures;
  }

  public functionsGet(): any[] {
    return this.functions;
  }

  public proceduresGet(): any[] {
    return this.procedures;
  }

  public functionDelete(name: string): void {
    const index = this.functions.findIndex((f) => f.function_name === name);
    if (index > -1) {
      this.functions.splice(index, 1);
    }
  }

  public procedureDelete(name: string): void {
    const index = this.procedures.findIndex((f) => f.procedure_name === name);
    if (index > -1) {
      this.procedures.splice(index, 1);
    }
  }
}
