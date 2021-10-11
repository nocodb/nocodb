import { GqlApiBuilder } from '../gql/GqlApiBuilder';
import { RestApiBuilder } from '../rest/RestApiBuilder';

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
    const index = this.functions.findIndex(f => f.function_name === name);
    if (index > -1) {
      this.functions.splice(index, 1);
    }
  }

  public procedureDelete(name: string): void {
    const index = this.procedures.findIndex(f => f.procedure_name === name);
    if (index > -1) {
      this.procedures.splice(index, 1);
    }
  }
}

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
