import type { ClientType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type CustomKnex from '~/db/CustomKnex';
import type { Source } from '~/models';
import type {
  ICteBlock,
  ICTEGenerator,
  ICteScope,
} from '~/db/cte-generator/types';
import { BaseUserGeneralCte } from '~/db/cte-generator/base-user.general.cte';
import { LookupGeneralCte } from '~/db/cte-generator/lookup.general.cte';
import { Base } from '~/models';
const CLIENT_DEFAULT = '_default';

export class CTEGenerator implements ICTEGenerator {
  constructor(
    protected readonly info: { context: NcContext; knex: CustomKnex },
  ) {}

  cteModules = {
    baseUser: {
      [CLIENT_DEFAULT]: BaseUserGeneralCte,
    },
    lookup: {
      [CLIENT_DEFAULT]: LookupGeneralCte,
    },
  };

  getCteModules<T>(
    moduleName: 'baseUser' | 'lookup' | 'links',
    clientType: ClientType,
  ) {
    const cteModuleClass =
      this.cteModules[moduleName][clientType] ??
      this.cteModules[moduleName][CLIENT_DEFAULT];
    return new cteModuleClass(clientType) as T;
  }

  blocks: Map<string, ICteBlock> = new Map<string, ICteBlock>();

  /**
   * How many open scopes own each alias. Two top-level formula columns in one
   * query each open their own scope, and if both reach a lookup onto the same
   * target formula they compute the same alias — so a rollback in one must not
   * delete a block the other is still referencing.
   */
  private blockRefs: Map<string, number> = new Map<string, number>();

  clientType?: ClientType;
  async getClientType() {
    if (this.clientType) {
      return this.clientType;
    }
    const base = await Base.get(this.info.context, this.info.context.base_id);
    const sources = await base.getSources();
    const source: Source = sources[0];
    this.clientType = source.type as any as ClientType;
    return this.clientType;
  }

  getExistingAlias(alias: string): ICteBlock {
    return this.blocks.get(alias);
  }

  async baseUser(param: { context?: NcContext; include_ws_deleted?: boolean }) {
    const cteBlock = await this.getCteModules<BaseUserGeneralCte>(
      'baseUser',
      await this.getClientType(),
    ).inquiry(
      {
        context: this.info.context,
        ...param,
      },
      this,
    );

    this.blocks.set(cteBlock.alias, cteBlock);
    return cteBlock;
  }

  customCte(cteBlock: ICteBlock) {
    this.blocks.set(cteBlock.alias, cteBlock);
    return cteBlock;
  }

  openScope(): ICteScope {
    const owned = new Map<string, ICteBlock>();
    const blocks = this.blocks;
    const refs = this.blockRefs;
    return {
      add(cteBlock: ICteBlock) {
        const existing = owned.get(cteBlock.alias);
        if (existing) return existing;
        // an equivalent block from another scope is reused rather than
        // overwritten, so both scopes reference the same object
        const shared = blocks.get(cteBlock.alias) ?? cteBlock;
        owned.set(cteBlock.alias, shared);
        blocks.set(cteBlock.alias, shared);
        refs.set(cteBlock.alias, (refs.get(cteBlock.alias) ?? 0) + 1);
        return shared;
      },
      get aliases() {
        return [...owned.keys()];
      },
      get blocks() {
        return [...owned.values()];
      },
      rollback() {
        for (const alias of owned.keys()) {
          const remaining = (refs.get(alias) ?? 1) - 1;
          if (remaining > 0) {
            refs.set(alias, remaining);
            continue; // another scope still references it
          }
          refs.delete(alias);
          blocks.delete(alias);
        }
        owned.clear();
      },
      restore() {
        for (const [alias, cteBlock] of owned) blocks.set(alias, cteBlock);
      },
    };
  }

  applyCte(qb: Knex.QueryInterface) {
    for (const [_alias, block] of this.blocks.entries()) {
      block.applyCte(qb, this.info);
    }
  }

  clear() {
    this.blocks.clear();
  }
}
