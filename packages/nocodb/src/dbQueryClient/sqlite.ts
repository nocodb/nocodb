import { arrFlatMap } from 'nocodb-sdk';
import type { DBQueryClient } from '~/dbQueryClient/types';
import type { XKnex } from '~/db/CustomKnex';

export class SqliteDBQueryClient implements DBQueryClient {
  temporaryTable({
    knex,
    data,
    fields,
    alias,
    asKnexFrom = true,
  }: {
    data: Record<string, any>[];
    fields: string[];
    alias: string;
    knex: XKnex;
    asKnexFrom?: boolean;
  }) {
    const fieldsValuePlaceholder = `(${fields.map(() => '?').join(',')})`;
    const valuesPlaceholder = data.map(() => fieldsValuePlaceholder).join(', ');
    const fieldsPlaceholder = fields.map(() => '??').join(',');
    const query = knex.raw(
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
    return asKnexFrom ? knex.from(query) : query;
  }

  concat(fields: string[]) {
    return `${fields.join(' || ')}`;
  }
  simpleCast(field: string, asType: string) {
    return `CAST(${field} as ${asType})`;
  }
}
