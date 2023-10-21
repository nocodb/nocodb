import type { BoolType } from 'nocodb-sdk';
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
  base_id?: string;
  source_id?: string;

  constructor(data: GalleryViewColumn) {
    Object.assign(this, data);
  }

  public static async get(galleryViewColumnId: string, ncMeta = Noco.ncMeta) {
    let view =
      galleryViewColumnId &&
      (await NocoCache.get(
        `${CacheScope.GALLERY_VIEW_COLUMN}:${galleryViewColumnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      view = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.GALLERY_VIEW_COLUMNS,
        galleryViewColumnId,
      );
      await NocoCache.set(
        `${CacheScope.GALLERY_VIEW_COLUMN}:${galleryViewColumnId}`,
        view,
      );
    }
    return view && new GalleryViewColumn(view);
  }
  static async insert(
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

    if (!(column.base_id && column.source_id)) {
      const viewRef = await View.get(column.fk_view_id, ncMeta);
      insertObj.base_id = viewRef.base_id;
      insertObj.source_id = viewRef.source_id;
    }

    const { id, fk_column_id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.GALLERY_VIEW_COLUMNS,
      insertObj,
    );

    await NocoCache.set(
      `${CacheScope.GALLERY_VIEW_COLUMN}:${fk_column_id}`,
      id,
    );

    // if cache is not present skip pushing it into the list to avoid unexpected behaviour
    const { list } = await NocoCache.getList(CacheScope.GALLERY_VIEW_COLUMN, [
      column.fk_view_id,
    ]);

    if (list?.length)
      await NocoCache.appendToList(
        CacheScope.GALLERY_VIEW_COLUMN,
        [column.fk_view_id],
        `${CacheScope.GALLERY_VIEW_COLUMN}:${id}`,
      );

    // on new view column, delete any optimised single query cache
    {
      const view = await View.get(column.fk_view_id, ncMeta);
      await NocoCache.delAll(
        CacheScope.SINGLE_QUERY,
        `${view.fk_model_id}:${view.id}:*`,
      );
    }

    return this.get(id, ncMeta);
  }

  public static async list(
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
        null,
        null,
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
}
