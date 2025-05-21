import type { ModelRoleVisibilityType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import View from '~/models/View';
import Noco from '~/Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';

export default class ModelRoleVisibility implements ModelRoleVisibilityType {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;
  // fk_model_id?: string;
  fk_view_id?: string;
  role?: string;
  disabled?: boolean;

  constructor(body: Partial<ModelRoleVisibilityType>) {
    Object.assign(this, body);
  }

  static async list(
    context: NcContext,
    baseId,
  ): Promise<ModelRoleVisibility[]> {
    const cachedList = await NocoCache.getList(
      CacheScope.MODEL_ROLE_VISIBILITY,
      [baseId],
    );
    let { list: data } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !data.length) {
      data = await Noco.ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.MODEL_ROLE_VISIBILITY,
      );
      await NocoCache.setList(
        CacheScope.MODEL_ROLE_VISIBILITY,
        [baseId],
        data,
        ['fk_view_id', 'role'],
      );
    }
    return data?.map((baseData) => new ModelRoleVisibility(baseData));
  }

  static async get(
    context: NcContext,
    args: { role: string; fk_view_id: any },
    ncMeta = Noco.ncMeta,
  ) {
    let data =
      args.fk_view_id &&
      args.role &&
      (await NocoCache.get(
        `${CacheScope.MODEL_ROLE_VISIBILITY}:${args.fk_view_id}:${args.role}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!data) {
      data = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.MODEL_ROLE_VISIBILITY,
        // args.fk_model_id
        //   ? {
        //       fk_model_id: args.fk_model_id,
        //       role: args.role
        //     }
        //   :
        {
          fk_view_id: args.fk_view_id,
          role: args.role,
        },
      );
      await NocoCache.set(
        `${CacheScope.MODEL_ROLE_VISIBILITY}:${args.fk_view_id}:${args.role}`,
        data,
      );
    }
    return data && new ModelRoleVisibility(data);
  }

  static async update(
    context: NcContext,
    fk_view_id: string,
    role: string,
    body: { disabled: any },
    ncMeta = Noco.ncMeta,
  ) {
    // set meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MODEL_ROLE_VISIBILITY,
      {
        disabled: body.disabled,
      },
      {
        fk_view_id,
        role,
      },
    );

    await NocoCache.update(
      `${CacheScope.MODEL_ROLE_VISIBILITY}:${fk_view_id}:${role}`,
      {
        disabled: body.disabled,
      },
    );

    return res;
  }

  async delete(context: NcContext, ncMeta = Noco.ncMeta) {
    return await ModelRoleVisibility.delete(
      context,
      this.fk_view_id,
      this.role,
      ncMeta,
    );
  }
  static async delete(
    context: NcContext,
    fk_view_id: string,
    role: string,
    ncMeta = Noco.ncMeta,
  ) {
    const res = await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.MODEL_ROLE_VISIBILITY,
      {
        fk_view_id,
        role,
      },
    );
    await NocoCache.deepDel(
      `${CacheScope.MODEL_ROLE_VISIBILITY}:${fk_view_id}:${role}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    return res;
  }

  static async insert(
    context: NcContext,
    body: Partial<ModelRoleVisibilityType>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(body, [
      'role',
      'disabled',
      'fk_view_id',
      'base_id',
      'source_id',
    ]);

    const view = await View.get(context, body.fk_view_id, ncMeta);

    if (!insertObj.source_id) {
      insertObj.source_id = view.source_id;
    }

    const result = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.MODEL_ROLE_VISIBILITY,
      insertObj,
    );

    insertObj.id = result.id;

    return this.get(
      context,
      {
        fk_view_id: body.fk_view_id,
        role: body.role,
      },
      ncMeta,
    ).then(async (modelRoleVisibility) => {
      const key = `${CacheScope.MODEL_ROLE_VISIBILITY}:${body.fk_view_id}:${body.role}`;
      await NocoCache.appendToList(
        CacheScope.MODEL_ROLE_VISIBILITY,
        [context.base_id],
        key,
      );
      return modelRoleVisibility;
    });
  }
}
