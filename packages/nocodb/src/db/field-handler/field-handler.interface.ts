import type { MetaService } from 'src/meta/meta.service';
import type { NcContext } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { Column, Filter, Model } from '~/models';

export interface HandlerOptions {
  alias?: string;
  throwErrorIfInvalid?: boolean;
  context?: NcContext;
  model?: Model;
  metaService?: MetaService;
  knex?: Knex;
  tnPath?: string;
}
export interface FilterVeriicationResult {
  isValid: boolean;
  errors?: string[];
}
export interface FieldHandlerInterface {
  select(qb: Knex.QueryBuilder, column: Column, options: HandlerOptions): void;
  filter(
    knex: Knex,
    filter: Filter,
    column: Column,
    options?: HandlerOptions,
  ): Promise<(qb: Knex.QueryBuilder) => void>;
  verifyFilter(
    filter: Filter,
    column: Column,
    options?: HandlerOptions,
  ): Promise<FilterVeriicationResult>;
}
