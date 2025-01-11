import type {
  AttachmentResType,
  BoolType,
  FormType,
  MetaType,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
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
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;
  meta?: MetaType;

  constructor(data: FormView) {
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
        `${CacheScope.FORM_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      view = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.FORM_VIEW,
        {
          fk_view_id: viewId,
        },
      );

      if (view) {
        view.meta = deserializeJSON(view.meta);
        await NocoCache.set(`${CacheScope.FORM_VIEW}:${viewId}`, view);
      } else {
        return null;
      }
    }

    const convertedAttachment = await this.convertAttachmentType(
      {
        banner_image_url: view?.banner_image_url,
        logo_url: view?.logo_url,
      },
      ncMeta,
    );

    view.banner_image_url = convertedAttachment.banner_image_url || null;
    view.logo_url = convertedAttachment.logo_url || null;

    return view && new FormView(view);
  }

  static async insert(
    context: NcContext,
    view: Partial<FormView>,
    ncMeta = Noco.ncMeta,
  ) {
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

    const viewRef = await View.get(context, view.fk_view_id, ncMeta);

    if (!view.source_id) {
      insertObj.source_id = viewRef.source_id;
    }
    await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.FORM_VIEW,
      insertObj,
      true,
    );

    return this.get(context, view.fk_view_id, ncMeta);
  }

  static async update(
    context: NcContext,
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
      context.workspace_id,
      context.base_id,
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

  async getColumns(context: NcContext, ncMeta = Noco.ncMeta) {
    return (this.columns = await FormViewColumn.list(
      context,
      this.fk_view_id,
      ncMeta,
    ));
  }

  static async getWithInfo(
    context: NcContext,
    formViewId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const form = await this.get(context, formViewId, ncMeta);
    await form.getColumns(context, ncMeta);
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
    ncMeta = Noco.ncMeta,
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

          promises.push(
            PresignedUrl.signAttachment(
              {
                attachment: formAttachments[key],
              },
              ncMeta,
            ),
          );
        }
        await Promise.all(promises);
      }
    } catch {}
    return formAttachments;
  }
}
