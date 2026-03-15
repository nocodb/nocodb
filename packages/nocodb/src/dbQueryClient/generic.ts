import {
  arrFlatMap,
  ClientType,
  ncIsNullOrUndefined,
  ncIsUndefined,
} from 'nocodb-sdk';
import type { DBQueryClient } from '~/dbQueryClient/types';
import type { Knex, XKnex } from '~/db/CustomKnex';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';

export abstract class GenericDBQueryClient implements DBQueryClient {
  get clientType(): ClientType {
    return ClientType.PG;
  }
  validateClientType(client: string) {
    if (client !== this.clientType) {
      throw new Error('Source is not ' + this.clientType);
    }
  }
  temporaryTableRaw({
    knex,
    data,
    fields,
    alias,
  }: {
    data: Record<string, any>[];
    fields: string[];
    alias: string;
    knex: XKnex;
  }) {
    const fieldsValuePlaceholder = `(${fields.map(() => '?').join(',')})`;
    const valuesPlaceholder = data.map(() => fieldsValuePlaceholder).join(', ');
    const fieldsPlaceholder = fields.map(() => '??').join(',');
    return knex.raw(
      `(VALUES ${valuesPlaceholder}) AS ?? (${fieldsPlaceholder})`,
      [
        ...arrFlatMap(
          data.map((row) =>
            fields.reduce((acc, field) => {
              acc.push(row[field]);
              return acc;
            }, []),
          ),
        ),
        alias,
        ...fields,
      ],
    );
  }
  temporaryTable(param: {
    data: Record<string, any>[];
    fields: string[];
    alias: string;
    knex: XKnex;
    asKnexFrom?: boolean;
  }) {
    return param.knex.from(this.temporaryTableRaw(param));
  }

  abstract concat(fields: string[]): string;
  abstract simpleCast(field: string, asType: string): string;

  generateNestedRowSelectQuery(_param: any): Knex.Raw<any> {
    throw new Error('Not implemented');
  }
  async singleQueryList(
    _context: any,
    _ctx: any,
  ): Promise<
    PagedResponseImpl<Record<string, any>> | Array<Record<string, any>>
  > {
    throw new Error('Not implemented');
  }
  async singleQueryRead(
    _context: any,
    _ctx: any,
  ): Promise<PagedResponseImpl<Record<string, any>>> {
    throw new Error('Not implemented');
  }

  async extractColumns(_param: any): Promise<void> {
    throw new Error('Not implemented');
  }

  async extractColumn(_param: any): Promise<{
    isArray?: boolean;
  }> {
    throw new Error('Not implemented');
  }

  massUpdateGenerateTempTable({
    data,
    updatingColumns,
    primaryKeyColumns,
  }: {
    data: Record<string, any>[];
    updatingColumns: string[];
    primaryKeyColumns: string[];
  }) {
    const resultUpdatingColumns = new Set<string>();
    // generate the update objects
    const resultData = data
      .map((d) => {
        const eachResult: any = {};
        // populate for primary key columns
        for (const primaryKeyColumn of primaryKeyColumns) {
          const pkValue = d[primaryKeyColumn];
          if (ncIsNullOrUndefined(pkValue)) {
            // when the row has a missing pk value, we skip
            return undefined;
          } else {
            eachResult[primaryKeyColumn] = pkValue;
          }
        }
        // populate for every updating columns
        for (const updatingColumn of updatingColumns) {
          const updatingValue = d[updatingColumn];
          if (ncIsUndefined(updatingValue)) {
            eachResult[updatingColumn] = null;
            // if it has no value (undefined) we skip update
            eachResult[`__upd__${updatingColumn}`] = false;
          } else {
            eachResult[updatingColumn] = updatingValue;
            // however if it has value then we mark to update
            eachResult[`__upd__${updatingColumn}`] = true;
            // only column with value will be added to query
            resultUpdatingColumns.add(updatingColumn);
          }
        }
        return eachResult;
      })
      // filter out all undefined
      .filter((r) => r);
    return { data: resultData, updatingColumns: [...resultUpdatingColumns] };
  }

  async massUpdate({
    knex,
    tableName,
    data,
    updatingColumns,
    primaryKeyColumns,
  }: {
    knex: Knex;
    tableName: string | Knex.Raw<any>;
    data: Record<string, any>[];
    updatingColumns: string[];
    primaryKeyColumns: string[];
  }): Promise<undefined> {
    if (!data.length) return null;

    const updatePromises: Promise<void>[] = [];
    for (const row of data) {
      const updatingObj: any = {};
      const query = knex(tableName);

      let firstPk = true;
      for (const primaryKeyColumn of primaryKeyColumns) {
        const primaryKeyValue = row[primaryKeyColumn];
        if (ncIsUndefined(primaryKeyValue)) {
          continue;
        }
        if (firstPk) {
          query.where(primaryKeyColumn, row[primaryKeyColumn]);
          firstPk = false;
        } else {
          query.andWhere(primaryKeyColumn, row[primaryKeyColumn]);
        }
      }
      for (const updatingColumn of updatingColumns) {
        const updatingValue = row[updatingColumn];
        if (!ncIsUndefined(updatingValue)) {
          updatingObj[updatingColumn] = updatingValue;
        }
      }
      updatePromises.push(query.update(row));
    }
    await Promise.all(updatePromises);
  }
}
