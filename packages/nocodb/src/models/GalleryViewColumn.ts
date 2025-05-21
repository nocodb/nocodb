import type { BoolType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import View from '~/models/View';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

export default class GalleryViewColumn {
  id: string;
  title?: string;
  show?: BoolType;
  order?: number;

  fk_view_id: string;
  fk_column_id: string;
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;

  constructor(data: GalleryViewColumn) {
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    galleryViewColumnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let viewColumn =
      galleryViewColumnId &&
      (await NocoCache.get(
        `${CacheScope.GALLERY_VIEW_COLUMN}:${galleryViewColumnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!viewColumn) {
      viewColumn = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.GALLERY_VIEW_COLUMNS,
        galleryViewColumnId,
      );
      if (viewColumn) {
        await NocoCache.set(
          `${CacheScope.GALLERY_VIEW_COLUMN}:${galleryViewColumnId}`,
          viewColumn,
        );
      }
    }
    return viewColumn && new GalleryViewColumn(viewColumn);
  }
  static async insert(
    context: NcContext,
    column: Partial<GalleryViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(column, [
      'fk_view_id',
      'fk_column_id',
      'show',
      'base_id',
      'source_id',
    ]);

    insertObj.order = await ncMeta.metaGetNextOrder(
      MetaTable.GALLERY_VIEW_COLUMNS,
      {
        fk_view_id: column.fk_view_id,
      },
    );

    if (!insertObj.source_id) {
      const viewRef = await View.get(context, insertObj.fk_view_id, ncMeta);
      insertObj.source_id = viewRef.source_id;
    }

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.GALLERY_VIEW_COLUMNS,
      insertObj,
    );

    // on new view column, delete any optimised single query cache
    {
      const view = await View.get(context, column.fk_view_id, ncMeta);
      await View.clearSingleQueryCache(
        context,
        view.fk_model_id,
        [view],
        ncMeta,
      );
    }

    return this.get(context, id, ncMeta).then(async (viewColumn) => {
      await NocoCache.appendToList(
        CacheScope.GALLERY_VIEW_COLUMN,
        [column.fk_view_id],
        `${CacheScope.GALLERY_VIEW_COLUMN}:${id}`,
      );
      return viewColumn;
    });
  }

  public static async list(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<GalleryViewColumn[]> {
    const cachedList = await NocoCache.getList(CacheScope.GALLERY_VIEW_COLUMN, [
      viewId,
    ]);
    let { list: views } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !views.length) {
      views = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.GALLERY_VIEW_COLUMNS,
        {
          condition: {
            fk_view_id: viewId,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );
      await NocoCache.setList(CacheScope.GALLERY_VIEW_COLUMN, [viewId], views);
    }
    views.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    return views?.map((v) => new GalleryViewColumn(v));
  }

  static async update(
    context: NcContext,
    columnId: string,
    body: Partial<GalleryViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(body, ['order', 'show']);

    // set meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.GALLERY_VIEW_COLUMNS,
      updateObj,
      columnId,
    );

    // get existing cache
    const key = `${CacheScope.GALLERY_VIEW_COLUMN}:${columnId}`;
    await NocoCache.update(key, updateObj);

    // on view column update, delete any optimised single query cache
    {
      const viewCol = await this.get(context, columnId, ncMeta);
      const view = await View.get(context, viewCol.fk_view_id, ncMeta);
      await View.clearSingleQueryCache(context, view.fk_model_id, [view]);
    }

    return res;
  }
}
