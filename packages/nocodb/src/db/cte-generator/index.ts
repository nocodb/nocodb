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
    return {
      add(cteBlock: ICteBlock) {
        const existing = owned.get(cteBlock.alias);
        if (existing) return existing;
        owned.set(cteBlock.alias, cteBlock);
        blocks.set(cteBlock.alias, cteBlock);
        return cteBlock;
      },
      get aliases() {
        return [...owned.keys()];
      },
      rollback() {
        for (const alias of owned.keys()) blocks.delete(alias);
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
