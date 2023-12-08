import type { ModelRoleVisibilityType } from 'nocodb-sdk';
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
  base_id?: string;
  source_id?: string;
  // fk_model_id?: string;
  fk_view_id?: string;
  role?: string;
  disabled?: boolean;

  constructor(body: Partial<ModelRoleVisibilityType>) {
    Object.assign(this, body);
  }

  static async list(baseId): Promise<ModelRoleVisibility[]> {
    const cachedList = await NocoCache.getList(
      CacheScope.MODEL_ROLE_VISIBILITY,
      [baseId],
    );
    let { list: data } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !data.length) {
      data = await Noco.ncMeta.metaList2(
        baseId,
        null,
        MetaTable.MODEL_ROLE_VISIBILITY,
      );
      await NocoCache.setList(CacheScope.MODEL_ROLE_VISIBILITY, [baseId], data);
    }
    return data?.map((baseData) => new ModelRoleVisibility(baseData));
  }

  static async get(
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
        null,
        null,
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
    fk_view_id: string,
    role: string,
    body: { disabled: any },
  ) {
    // get existing cache
    const key = `${CacheScope.MODEL_ROLE_VISIBILITY}:${fk_view_id}:${role}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      // update data
      o.disabled = body.disabled;
      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    return await Noco.ncMeta.metaUpdate(
      null,
      null,
      MetaTable.MODEL_ROLE_VISIBILITY,
      {
        disabled: body.disabled,
      },
      {
        fk_view_id,
        role,
      },
    );
  }

  async delete() {
    return await ModelRoleVisibility.delete(this.fk_view_id, this.role);
  }
  static async delete(fk_view_id: string, role: string) {
    await NocoCache.deepDel(
      CacheScope.MODEL_ROLE_VISIBILITY,
      `${CacheScope.MODEL_ROLE_VISIBILITY}:${fk_view_id}:${role}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    return await Noco.ncMeta.metaDelete(
      null,
      null,
      MetaTable.MODEL_ROLE_VISIBILITY,
      {
        fk_view_id,
        role,
      },
    );
  }

  static async insert(
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

    if (!(insertObj.base_id && insertObj.source_id)) {
      const view = await View.get(body.fk_view_id, ncMeta);
      insertObj.base_id = view.base_id;
      insertObj.source_id = view.source_id;
    }

    const result = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.MODEL_ROLE_VISIBILITY,
      insertObj,
    );

    const key = `${CacheScope.MODEL_ROLE_VISIBILITY}:${body.fk_view_id}:${body.role}`;

    insertObj.id = result.id;

    await NocoCache.appendToList(
      CacheScope.MODEL_ROLE_VISIBILITY,
      [insertObj.base_id],
      key,
    );

    return this.get(
      {
        fk_view_id: body.fk_view_id,
        role: body.role,
      },
      ncMeta,
    );
  }
}
