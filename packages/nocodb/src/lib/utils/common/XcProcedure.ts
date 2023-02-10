import BaseApiBuilder from './BaseApiBuilder';

export default class XcProcedure {
  private builder: BaseApiBuilder<any>;

  constructor(builder: BaseApiBuilder<any>) {
    this.builder = builder;
  }

  public async callFunction(name: string, args: any[]) {
    try {
      if (this.builder.getDbType() === 'mssql') {
        const result = await (
          await this.builder.getDbDriver()
        ).raw(
          `select dbo.??(${new Array(args.length).fill('?').join(',')}) as ??`,
          [name, ...args, name]
        );
        return result[0];
      } else {
        const result = await (
          await this.builder.getDbDriver()
        ).raw(
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
          (await this.builder.getDbDriver()).schema
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
        const result = await (
          await this.builder.getDbDriver()
        ).raw(`Call ??(${new Array(args.length).fill('?').join(',')})`, [
          name,
          ...args,
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
