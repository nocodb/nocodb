import ListViewCE from 'src/models/ListView';
import type { BoolType, ListType, MetaType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import View from '~/models/View';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import {
  prepareForDb,
  prepareForResponse,
  stringifyMetaProp,
} from '~/utils/modelUtils';
import ListViewLevel from '~/models/ListViewLevel';

export default class ListView extends ListViewCE implements ListType {
  fk_view_id: string;
  title: string;
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;
  meta?: MetaType;
  show_empty_parents?: BoolType | boolean;
  row_height?: number;
  fk_prefix_column_id?: string;
  levels?: ListViewLevel[];

  constructor(data: ListView) {
    super(data);
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let view =
      viewId &&
      (await NocoCache.get(
        context,
        `${CacheScope.LIST_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      view = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.LIST_VIEW,
        {
          fk_view_id: viewId,
        },
      );

      view = prepareForResponse(view);

      await NocoCache.set(context, `${CacheScope.LIST_VIEW}:${viewId}`, view);
    }

    if (view) {
      const levels = await ListViewLevel.list(context, viewId, ncMeta);
      view.levels = levels;
    }

    return view && new ListView(view);
  }

  static async insert(
    context: NcContext,
    view: Partial<ListView>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(view, [
      'base_id',
      'source_id',
      'fk_view_id',
      'meta',
      'show_empty_parents',
      'row_height',
      'fk_prefix_column_id',
    ]);

    if (insertObj.meta) {
      insertObj.meta = stringifyMetaProp(insertObj);
    }

    const viewRef = await View.get(context, insertObj.fk_view_id, ncMeta);

    if (!insertObj.source_id) {
      insertObj.source_id = viewRef.source_id;
    }

    await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.LIST_VIEW,
      insertObj,
      true,
    );

    return this.get(context, view.fk_view_id, ncMeta);
  }

  static async update(
    context: NcContext,
    listViewId: string,
    body: Partial<ListView>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(body, ['meta', 'show_empty_parents', 'row_height', 'fk_prefix_column_id']);

    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.LIST_VIEW,
      prepareForDb(updateObj),
      {
        fk_view_id: listViewId,
      },
    );

    await NocoCache.update(
      context,
      `${CacheScope.LIST_VIEW}:${listViewId}`,
      prepareForResponse(updateObj),
    );

    const view = await View.get(context, listViewId);

    await View.clearSingleQueryCache(
      context,
      view.fk_model_id,
      [{ id: listViewId }],
      ncMeta,
    );

    return res;
  }
}
