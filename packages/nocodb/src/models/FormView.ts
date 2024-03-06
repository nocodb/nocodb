import type {
  AttachmentResType,
  BoolType,
  FormType,
  MetaType,
} from 'nocodb-sdk';
import { PresignedUrl } from '~/models';
import FormViewColumn from '~/models/FormViewColumn';
import View from '~/models/View';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';
import Noco from '~/Noco';
import { deserializeJSON, serializeJSON } from '~/utils/serialize';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

type FormViewType = Omit<FormType, 'banner_image_url' | 'logo_url'> & {
  banner_image_url?: AttachmentResType | string;
  logo_url?: AttachmentResType | string;
};

export default class FormView implements FormViewType {
  show: BoolType;
  is_default: BoolType;
  order: number;
  title?: string;
  heading?: string;
  subheading?: string;
  success_msg?: string;
  redirect_url?: string;
  redirect_after_secs?: string;
  email?: string;
  banner_image_url?: AttachmentResType | string;
  logo_url?: AttachmentResType | string;
  submit_another_form?: BoolType;
  show_blank_form?: BoolType;

  fk_view_id: string;
  columns?: FormViewColumn[];
  base_id?: string;
  source_id?: string;
  meta?: MetaType;

  constructor(data: FormView) {
    Object.assign(this, data);
  }

  public static async get(viewId: string, ncMeta = Noco.ncMeta) {
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.FORM_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      view = await ncMeta.metaGet2(null, null, MetaTable.FORM_VIEW, {
        fk_view_id: viewId,
      });

      if (view) {
        view.meta = deserializeJSON(view.meta);
        await NocoCache.set(`${CacheScope.FORM_VIEW}:${viewId}`, view);
      }
    }

    const convertedAttachment = await this.convertAttachmentType({
      banner_image_url: view?.banner_image_url,
      logo_url: view?.logo_url,
    });

    view.banner_image_url = convertedAttachment.banner_image_url || null;
    view.logo_url = convertedAttachment.logo_url || null;

    return view && new FormView(view);
  }

  static async insert(view: Partial<FormView>, ncMeta = Noco.ncMeta) {
    const insertObj = extractProps(view, [
      'fk_view_id',
      'base_id',
      'source_id',
      'heading',
      'subheading',
      'success_msg',
      'redirect_url',
      'redirect_after_secs',
      'email',
      'banner_image_url',
      'logo_url',
      'submit_another_form',
      'show_blank_form',
      'meta',
    ]);
    if (insertObj.meta) {
      insertObj.meta = serializeJSON(insertObj.meta);
    }

    if (insertObj?.logo_url) {
      insertObj.logo_url = this.serializeAttachmentJSON(insertObj.logo_url);
    }

    if (insertObj?.banner_image_url) {
      insertObj.banner_image_url = this.serializeAttachmentJSON(
        insertObj.banner_image_url,
      );
    }

    if (!(view.base_id && view.source_id)) {
      const viewRef = await View.get(view.fk_view_id);
      insertObj.base_id = viewRef.base_id;
      insertObj.source_id = viewRef.source_id;
    }
    await ncMeta.metaInsert2(null, null, MetaTable.FORM_VIEW, insertObj, true);

    return this.get(view.fk_view_id, ncMeta);
  }

  static async update(
    formId: string,
    body: Partial<FormView>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(body, [
      'heading',
      'subheading',
      'success_msg',
      'redirect_url',
      'redirect_after_secs',
      'email',
      'banner_image_url',
      'logo_url',
      'submit_another_form',
      'show_blank_form',
      'meta',
    ]);

    if (updateObj?.logo_url) {
      updateObj.logo_url = this.serializeAttachmentJSON(updateObj.logo_url);
    }

    if (updateObj?.banner_image_url) {
      updateObj.banner_image_url = this.serializeAttachmentJSON(
        updateObj.banner_image_url,
      );
    }

    // update meta
    const res = await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.FORM_VIEW,
      prepareForDb(updateObj),
      {
        fk_view_id: formId,
      },
    );

    await NocoCache.update(
      `${CacheScope.FORM_VIEW}:${formId}`,
      prepareForResponse(updateObj),
    );

    return res;
  }

  async getColumns(ncMeta = Noco.ncMeta) {
    return (this.columns = await FormViewColumn.list(this.fk_view_id, ncMeta));
  }

  static async getWithInfo(formViewId: string, ncMeta = Noco.ncMeta) {
    const form = await this.get(formViewId, ncMeta);
    await form.getColumns(ncMeta);
    return form;
  }

  static serializeAttachmentJSON(attachment): string | null {
    if (attachment) {
      return serializeJSON(
        extractProps(deserializeJSON(attachment), [
          'url',
          'path',
          'title',
          'mimetype',
          'size',
          'icon',
        ]),
      );
    }
    return attachment;
  }

  protected static async convertAttachmentType(
    formAttachments: Record<string, any>,
  ) {
    try {
      if (formAttachments) {
        const promises = [];

        for (const key in formAttachments) {
          if (
            formAttachments[key] &&
            typeof formAttachments[key] === 'string'
          ) {
            formAttachments[key] = deserializeJSON(formAttachments[key]);
          }

          if (formAttachments[key]?.path) {
            promises.push(
              PresignedUrl.getSignedUrl({
                path: formAttachments[key].path.replace(/^download\//, ''),
              }).then((r) => (formAttachments[key].signedPath = r)),
            );
          } else if (formAttachments[key]?.url) {
            if (formAttachments[key].url.includes('.amazonaws.com/')) {
              const relativePath = decodeURI(
                formAttachments[key].url.split('.amazonaws.com/')[1],
              );
              promises.push(
                PresignedUrl.getSignedUrl({
                  path: relativePath,
                  s3: true,
                }).then((r) => (formAttachments[key].signedUrl = r)),
              );
            }
          }
        }
        await Promise.all(promises);
      }
    } catch {}
    return formAttachments;
  }
}
