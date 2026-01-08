import { arrFlatMap } from 'nocodb-sdk';
import type { DBQueryClient } from '~/dbQueryClient/types';
import type { XKnex } from '~/db/CustomKnex';

export class PGDBQueryClient implements DBQueryClient {
  temporaryTable({
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
    return knex.from(
      knex.raw(`(VALUES ${valuesPlaceholder}) AS ?? (${fieldsPlaceholder})`, [
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
      ]),
    );
  }
}
