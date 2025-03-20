import type { NcContext } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { Column, Filter, Sort } from '~/models';

interface HandlerOptions {
  alias?: string;
  throwErrorIfInvalid?: boolean;
  context?: NcContext;
  knex?: Knex;
  tnPath?: string;
  columns?: Column[];
}

interface FieldHandlerInterface {
  select(qb: Knex.QueryBuilder, column: Column, options: HandlerOptions): void;
  filter(
    qb: Knex.QueryBuilder,
    filter: Filter,
    column: Column,
    options: HandlerOptions,
  ): void | Promise<void>;
  sort(
    qb: Knex.QueryBuilder,
    sort: Sort,
    column: Column,
    options: HandlerOptions,
  ): void | Promise<void>;
}

const DbClient = {
  PG: 'pg',
  MYSQL: 'mysql',
  SQLITE: 'sqlite',
  MSSQL: 'mssql',
} as const;

type DbClient = (typeof DbClient)[keyof typeof DbClient];

export { FieldHandlerInterface, HandlerOptions, DbClient };
