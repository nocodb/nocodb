import { UITypes } from 'nocodb-sdk';
import Noco from '../Noco';
import { CacheGetType, CacheScope, MetaTable } from '../utils/globals';
import NocoCache from '../cache/NocoCache';
import { extractProps } from '../meta/helpers/extractProps';
import View from './View';
import type { BoolType, GalleryColumnType, GalleryType } from 'nocodb-sdk';

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

  project_id?: string;
  base_id?: string;

  columns?: GalleryColumnType[];

  constructor(data: GalleryView) {
    Object.assign(this, data);
  }

  public static async get(viewId: string, ncMeta = Noco.ncMeta) {
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.GALLERY_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT
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
      'project_id',
      'base_id',
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

    if (!(view.project_id && view.base_id)) {
      const viewRef = await View.get(view.fk_view_id);
      insertObj.project_id = viewRef.project_id;
      insertObj.base_id = viewRef.base_id;
    }

    await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.GALLERY_VIEW,
      insertObj,
      true
    );

    return this.get(view.fk_view_id, ncMeta);
  }

  static async update(
    galleryId: string,
    body: Partial<GalleryView>,
    ncMeta = Noco.ncMeta
  ) {
    // get existing cache
    const key = `${CacheScope.GALLERY_VIEW}:${galleryId}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    const updateObj = extractProps(body, [
      'next_enabled',
      'prev_enabled',
      'cover_image_idx',
      'cover_image',
      'restrict_types',
      'restrict_size',
      'restrict_number',
      'fk_cover_image_col_id',
    ]);
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
      }
    );
  }
}
