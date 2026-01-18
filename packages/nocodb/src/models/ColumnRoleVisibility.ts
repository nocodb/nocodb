import type { NcContext } from '~/interface/config';

export interface ColumnRoleVisibilityType {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;
  fk_column_id?: string;
  role?: string;
  disabled?: boolean;
}
import Column from '~/models/Column';
import Noco from '~/Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';

export default class ColumnRoleVisibility implements ColumnRoleVisibilityType {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;
  fk_column_id?: string;
  role?: string;
  disabled?: boolean;

  constructor(body: Partial<ColumnRoleVisibilityType>) {
    Object.assign(this, body);
  }

  static async list(
    context: NcContext,
    baseId: string,
  ): Promise<ColumnRoleVisibility[]> {
    const cachedList = await NocoCache.getList(
      CacheScope.COLUMN_ROLE_VISIBILITY,
      [baseId],
    );
    let { list: data } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !data.length) {
      data = await Noco.ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.COLUMN_ROLE_VISIBILITY,
        {
          condition: {
            base_id: baseId,
          },
        },
      );
      await NocoCache.setList(
        CacheScope.COLUMN_ROLE_VISIBILITY,
        [baseId],
        data,
        ['fk_column_id', 'role'],
      );
    }
    return data?.map((baseData) => new ColumnRoleVisibility(baseData));
  }

  static async get(
    context: NcContext,
    args: { role: string; fk_column_id: string },
    ncMeta = Noco.ncMeta,
  ) {
    let data =
      args.fk_column_id &&
      args.role &&
      (await NocoCache.get(
        `${CacheScope.COLUMN_ROLE_VISIBILITY}:${args.fk_column_id}:${args.role}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!data) {
      data = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.COLUMN_ROLE_VISIBILITY,
        {
          fk_column_id: args.fk_column_id,
          role: args.role,
        },
      );
      await NocoCache.set(
        `${CacheScope.COLUMN_ROLE_VISIBILITY}:${args.fk_column_id}:${args.role}`,
        data,
      );
    }
    return data && new ColumnRoleVisibility(data);
  }

  static async update(
    context: NcContext,
    fk_column_id: string,
    role: string,
    body: { disabled: boolean },
    ncMeta = Noco.ncMeta,
  ) {
    // set meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMN_ROLE_VISIBILITY,
      {
        disabled: body.disabled,
      },
      {
        fk_column_id,
        role,
      },
    );

    await NocoCache.update(
      `${CacheScope.COLUMN_ROLE_VISIBILITY}:${fk_column_id}:${role}`,
      {
        disabled: body.disabled,
      },
    );

    return res;
  }

  async delete(context: NcContext, ncMeta = Noco.ncMeta) {
    return await ColumnRoleVisibility.delete(
      context,
      this.fk_column_id,
      this.role,
      ncMeta,
    );
  }
  static async delete(
    context: NcContext,
    fk_column_id: string,
    role: string,
    ncMeta = Noco.ncMeta,
  ) {
    const res = await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMN_ROLE_VISIBILITY,
      {
        fk_column_id,
        role,
      },
    );
    await NocoCache.deepDel(
      `${CacheScope.COLUMN_ROLE_VISIBILITY}:${fk_column_id}:${role}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    return res;
  }

  static async insert(
    context: NcContext,
    body: Partial<ColumnRoleVisibilityType>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(body, [
      'role',
      'disabled',
      'fk_column_id',
      'base_id',
      'source_id',
    ]);

    const column = await Column.get(
      context,
      { colId: body.fk_column_id },
      ncMeta,
    );

    if (!insertObj.source_id) {
      insertObj.source_id = column.source_id;
    }

    if (!insertObj.base_id) {
      insertObj.base_id = column.base_id;
    }

    const result = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMN_ROLE_VISIBILITY,
      insertObj,
    );

    insertObj.id = result.id;

    return this.get(
      context,
      {
        fk_column_id: body.fk_column_id,
        role: body.role,
      },
      ncMeta,
    ).then(async (columnRoleVisibility) => {
      const key = `${CacheScope.COLUMN_ROLE_VISIBILITY}:${body.fk_column_id}:${body.role}`;
      await NocoCache.appendToList(
        CacheScope.COLUMN_ROLE_VISIBILITY,
        [context.base_id],
        key,
      );
      return columnRoleVisibility;
    });
  }
}
