import { arrFlatMap } from 'nocodb-sdk';
import type { DBQueryClient } from '~/dbQueryClient/types';
import type { XKnex } from '~/db/CustomKnex';

export abstract class GenericDBQueryClient implements DBQueryClient {
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
}
