import { UITypes } from 'nocodb-sdk';
import type {
  BoolType,
  GalleryColumnType,
  GalleryType,
  MetaType,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import View from '~/models/View';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import {
  parseMetaProp,
  prepareForDb,
  prepareForResponse,
  stringifyMetaProp,
} from '~/utils/modelUtils';

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

  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;

  columns?: GalleryColumnType[];
  meta?: MetaType;

  constructor(data: GalleryView) {
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
        `${CacheScope.GALLERY_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      view = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.GALLERY_VIEW,
        {
          fk_view_id: viewId,
        },
      );
      await NocoCache.set(`${CacheScope.GALLERY_VIEW}:${viewId}`, view);
    }

    return view && new GalleryView(view);
  }

  static async insert(
    context: NcContext,
    view: Partial<GalleryView>,
    ncMeta = Noco.ncMeta,
  ) {
    const columns = await View.get(context, view.fk_view_id, ncMeta)
      .then((v) => v?.getModel(context, ncMeta))
      .then((m) => m.getColumns(context, ncMeta));

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
      'meta',
    ]);

    insertObj.fk_cover_image_col_id =
      view?.fk_cover_image_col_id !== undefined
        ? view?.fk_cover_image_col_id
        : columns?.find((c) => c.uidt === UITypes.Attachment)?.id;

    insertObj.meta = {
      fk_cover_image_object_fit:
        parseMetaProp(insertObj)?.fk_cover_image_object_fit || 'fit',
    };

    insertObj.meta = stringifyMetaProp(insertObj);

    const viewRef = await View.get(context, insertObj.fk_view_id, ncMeta);

    if (!insertObj.source_id) {
      insertObj.source_id = viewRef.source_id;
    }

    await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.GALLERY_VIEW,
      insertObj,
      true,
    );

    return this.get(context, view.fk_view_id, ncMeta);
  }

  static async update(
    context: NcContext,
    galleryId: string,
    body: Partial<GalleryView>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(body, ['fk_cover_image_col_id', 'meta']);

    // update meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.GALLERY_VIEW,
      prepareForDb(updateObj),
      {
        fk_view_id: galleryId,
      },
    );

    await NocoCache.update(
      `${CacheScope.GALLERY_VIEW}:${galleryId}`,
      prepareForResponse(updateObj),
    );

    const view = await View.get(context, galleryId, ncMeta);

    // on update, delete any optimised single query cache
    await View.clearSingleQueryCache(
      context,
      view.fk_model_id,
      [{ id: galleryId }],
      ncMeta,
    );

    return res;
  }
}
