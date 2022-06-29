import BaseApiBuilder from './BaseApiBuilder';

export default class XcProcedure {
  private builder: BaseApiBuilder<any>;

  constructor(builder: BaseApiBuilder<any>) {
    this.builder = builder;
  }

  public async callFunction(name: string, args: any[]) {
    try {
      if (this.builder.getDbType() === 'mssql') {
        const result = await this.builder
          .getDbDriver()
          .raw(
            `select dbo.??(${new Array(args.length)
              .fill('?')
              .join(',')}) as ??`,
            [name, ...args, name]
          );
        return result[0];
      } else {
        const result = await this.builder
          .getDbDriver()
          .raw(
            `select ??(${new Array(args.length).fill('?').join(',')}) as ??`,
            [name, ...args, name]
          );
        return result[0];
      }
    } catch (e) {
      throw e;
    }
  }

  public async callProcedure(name: string, args: any[]) {
    try {
      if (this.builder.getDbType() === 'mssql') {
        throw new Error('Not implemented');
        /*
            const sql = require('mssql');
            const request = new sql.Request({
                "user": "sa",
                "password": "Password123.",
                "server": "localhost",
                "port": 1433,
                "database": "mssql_dev_1"
              });
            request.input('id', sql.Int, 5);
            request.output('result', sql.VarChar(50));
            request.execute('SP_TEST3', function (err, recordsets, returnValue) {
              console.log(request.parameters.result.value, err, recordsets, returnValue);
            });
        */

        // todo: mssql procedure handling
        // refer : https://stackoverflow.com/a/54101441
        // https://github.com/knex/knex/issues/2764#issuecomment-458879508
        // const result = '' // mcnd await this.builder.getDbDriver().raw(`Call ??(${Array.from({length: count}, (_, i) => '@var' + i).join(',')})`, [name]);
        //
        // return result)
      } else if (
        this.builder.getDbType() === 'mysql2' ||
        this.builder.getDbType() === 'mysql'
      ) {
        const knexRef = args.reduce(
          (knex, val, i) => knex.raw(`SET @var${i}=?`, [val]),
          this.builder.getDbDriver().schema
        );
        const count = args.length;
        const result = await knexRef.raw(
          `Call ??(${Array.from({ length: count }, (_, i) => '@var' + i).join(
            ','
          )})`,
          [name]
        );
        return [result[count][0][0]];
      } else if (this.builder.getDbType() === 'pg') {
        const result = await this.builder
          .getDbDriver()
          .raw(`Call ??(${new Array(args.length).fill('?').join(',')})`, [
            name,
            ...args
          ]);
        return result;
      } else {
        throw new Error('Not implemented');
      }
    } catch (e) {
      throw e;
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
