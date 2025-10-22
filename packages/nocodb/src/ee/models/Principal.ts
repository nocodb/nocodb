import type { NcContext } from '~/interface/config';
import type { PrincipalType } from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

export default class Principal {
  id: string;
  principal_type: PrincipalType; // Uses PrincipalType enum
  ref_id: string; // FK to user/team/bot table
  created_at?: string;
  updated_at?: string;

  constructor(data: Principal) {
    Object.assign(this, data);
  }

  protected static castType(principal: Principal): Principal {
    return principal && new Principal(principal);
  }

  public static async insert(
    context: NcContext,
    principal: Partial<Principal>,
    ncMeta = Noco.ncMeta,
  ): Promise<Principal> {
    const insertObj = extractProps(principal, [
      'id',
      'principal_type',
      'ref_id',
    ]);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.PRINCIPALS,
      insertObj,
    );

    const principalData = await ncMeta.metaGet(
      context.workspace_id,
      context.base_id,
      MetaTable.PRINCIPALS,
      id,
    );

    await NocoCache.set(
      context,
      `${CacheScope.PRINCIPAL}:${id}`,
      principalData,
    );

    return this.castType(principalData);
  }

  public static async get(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Principal | null> {
    let principalData = await NocoCache.get(
      context,
      `${CacheScope.PRINCIPAL}:${id}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!principalData) {
      principalData = await ncMeta.metaGet(
        context.workspace_id,
        context.base_id,
        MetaTable.PRINCIPALS,
        id,
      );

      if (principalData) {
        await NocoCache.set(
          context,
          `${CacheScope.PRINCIPAL}:${id}`,
          principalData,
        );
      }
    }

    return principalData ? this.castType(principalData) : null;
  }

  public static async getByTypeAndRef(
    context: NcContext,
    principalType: PrincipalType,
    refId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Principal | null> {
    const principals = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.PRINCIPALS,
      {
        condition: {
          principal_type: principalType,
          ref_id: refId,
        },
      },
    );

    return principals.length > 0 ? this.castType(principals[0]) : null;
  }

  public static async list(
    context: NcContext,
    filter?: {
      principal_type?: PrincipalType;
      ref_id?: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Principal[]> {
    const principals = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.PRINCIPALS,
      {
        condition: filter,
      },
    );

    return principals.map((principal) => this.castType(principal));
  }

  public static async delete(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.PRINCIPALS,
      id,
    );

    await NocoCache.del(context, `${CacheScope.PRINCIPAL}:${id}`);
  }

  public static async deleteByTypeAndRef(
    context: NcContext,
    principalType: PrincipalType,
    refId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const principals = await this.list(context, {
      principal_type: principalType,
      ref_id: refId,
    });

    for (const principal of principals) {
      await this.delete(context, principal.id, ncMeta);
    }
  }
}
