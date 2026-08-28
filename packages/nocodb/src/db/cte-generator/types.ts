import type { Knex } from 'knex';
import type { ClientType, NcContext } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';

export interface ICteBlock<T = any> {
  applyCte: (
    qb: Knex.QueryInterface,
    param: { context: NcContext; knex: CustomKnex },
  ) => void;
  alias: string; // to prevent multiple alias defined
  extra?: T;
}

/**
 * Ownership handle over the blocks one caller registered. Needed because the
 * block map is shared and `applyCte` clears it: a caller must be able to undo
 * only its own registrations (all-or-nothing rollback), and to re-register them
 * when something else consumed the map mid-build — which the `validateFormula`
 * dry-run does, since it runs `execAndParse` before the real query exists.
 */
export interface ICteScope {
  /** Register a block and take ownership of its alias. Idempotent per alias. */
  add(cteBlock: ICteBlock): ICteBlock;
  /** Aliases this scope owns, in registration order. */
  readonly aliases: string[];
  /** Blocks this scope owns — so a caller can measure what it registered. */
  readonly blocks: ICteBlock[];
  /** Drop only this scope's blocks from the shared map. */
  rollback(): void;
  /** Re-register this scope's blocks (e.g. after an external `clear()`). */
  restore(): void;
}

export interface ICTEGenerator {
  baseUser(param: {
    context?: NcContext;
    include_ws_deleted?: boolean;
    mode?: 'viewer' | 'full';
  }): Promise<ICteBlock>;

  getExistingAlias(alias: string): ICteBlock;
  getCteModules<T>(
    moduleName: 'baseUser' | 'lookup' | 'links',
    clientType: ClientType,
  ): T;

  applyCte(qb: Knex.QueryInterface): void;
  customCte(cteBlock: ICteBlock): ICteBlock;
  openScope(): ICteScope;
}
