import { UITypes } from 'nocodb-sdk';
import type {
  BoolType,
  GalleryColumnType,
  GalleryType,
  MetaType,
} from 'nocodb-sdk';
import View from '~/models/View';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

export default class GalleryView implements GalleryType {
  fk_view_id?: string;
  deleted?: BoolType;
  order?: number;
  next_enabled?: BoolType;
  prev_enabled?: BoolType;
  cover_image_idx?: number;
  cover_image?: string;
  restrict_types?: string;
  restrict_size?: string;
  restrict_number?: string;
  public?: BoolType;
  password?: string;
  show_all_fields?: BoolType;
  fk_cover_image_col_id?: string;

  base_id?: string;
  source_id?: string;

  columns?: GalleryColumnType[];
  meta?: MetaType;

  constructor(data: GalleryView) {
    Object.assign(this, data);
  }

  public static async get(viewId: string, ncMeta = Noco.ncMeta) {
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.GALLERY_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      view = await ncMeta.metaGet2(null, null, MetaTable.GALLERY_VIEW, {
        fk_view_id: viewId,
      });
      await NocoCache.set(`${CacheScope.GALLERY_VIEW}:${viewId}`, view);
    }

    return view && new GalleryView(view);
  }

  static async insert(view: Partial<GalleryView>, ncMeta = Noco.ncMeta) {
    const columns = await View.get(view.fk_view_id, ncMeta)
      .then((v) => v?.getModel(ncMeta))
      .then((m) => m.getColumns(ncMeta));

    const insertObj = extractProps(view, [
      'base_id',
      'source_id',
      'fk_view_id',
      'next_enabled',
      'prev_enabled',
      'cover_image_idx',
      'cover_image',
      'restrict_types',
      'restrict_size',
      'restrict_number',
    ]);

    insertObj.fk_cover_image_col_id =
      view?.fk_cover_image_col_id ||
      columns?.find((c) => c.uidt === UITypes.Attachment)?.id;

    if (!(view.base_id && view.source_id)) {
      const viewRef = await View.get(view.fk_view_id);
      insertObj.base_id = viewRef.base_id;
      insertObj.source_id = viewRef.source_id;
    }

    await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.GALLERY_VIEW,
      insertObj,
      true,
    );

    return this.get(view.fk_view_id, ncMeta);
  }

  static async update(
    galleryId: string,
    body: Partial<GalleryView>,
    ncMeta = Noco.ncMeta,
  ) {
    // get existing cache
    const key = `${CacheScope.GALLERY_VIEW}:${galleryId}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);

    const updateObj = extractProps(body, ['fk_cover_image_col_id', 'meta']);
    if (updateObj.meta && typeof updateObj.meta === 'object') {
      updateObj.meta = JSON.stringify(updateObj.meta ?? {});
    }

    if (o) {
      o = { ...o, ...updateObj };
      // set cache
      await NocoCache.set(key, o);
    }
    // update meta
    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.GALLERY_VIEW,
      updateObj,
      {
        fk_view_id: galleryId,
      },
    );
  }
}
