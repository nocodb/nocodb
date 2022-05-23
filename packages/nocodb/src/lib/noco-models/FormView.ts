import Noco from '../noco/Noco';
import { CacheGetType, CacheScope, MetaTable } from '../utils/globals';
import { FormType } from 'nocodb-sdk';
import FormViewColumn from './FormViewColumn';
import View from './View';
import NocoCache from '../noco-cache/NocoCache';

export default class FormView implements FormType {
  show: boolean;
  is_default: boolean;
  order: number;
  title?: string;
  heading?: string;
  subheading?: string;
  success_msg?: string;
  redirect_url?: string;
  redirect_after_secs?: string;
  email?: string;
  banner_image_url?: string;
  logo_url?: string;
  submit_another_form?: boolean;
  show_blank_form?: boolean;

  fk_view_id: string;
  columns?: FormViewColumn[];

  project_id?: string;
  base_id?: string;

  constructor(data: FormView) {
    Object.assign(this, data);
  }

  public static async get(viewId: string, ncMeta = Noco.ncMeta) {
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.FORM_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!view) {
      view = await ncMeta.metaGet2(null, null, MetaTable.FORM_VIEW, {
        fk_view_id: viewId
      });
      await NocoCache.set(`${CacheScope.FORM_VIEW}:${viewId}`, view);
    }
    return view && new FormView(view);
  }

  static async insert(view: Partial<FormView>, ncMeta = Noco.ncMeta) {
    const insertObj = {
      fk_view_id: view.fk_view_id,
      project_id: view.project_id,
      base_id: view.base_id,
      heading: view.heading,
      subheading: view.subheading,
      success_msg: view.success_msg,
      redirect_url: view.redirect_url,
      redirect_after_secs: view.redirect_after_secs,
      email: view.email,
      banner_image_url: view.banner_image_url,
      logo_url: view.logo_url,
      submit_another_form: view.submit_another_form,
      show_blank_form: view.show_blank_form
    };
    if (!(view.project_id && view.base_id)) {
      const viewRef = await View.get(view.fk_view_id);
      insertObj.project_id = viewRef.project_id;
      insertObj.base_id = viewRef.base_id;
    }
    await ncMeta.metaInsert2(null, null, MetaTable.FORM_VIEW, insertObj, true);

    return this.get(view.fk_view_id, ncMeta);
  }

  static async update(
    formId: string,
    body: Partial<FormView>,
    ncMeta = Noco.ncMeta
  ) {
    // get existing cache
    const key = `${CacheScope.FORM_VIEW}:${formId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      o.heading = body.heading;
      o.subheading = body.subheading;
      o.success_msg = body.success_msg;
      o.redirect_url = body.redirect_url;
      o.redirect_after_secs = body.redirect_after_secs;
      o.email = body.email;
      o.banner_image_url = body.banner_image_url;
      o.logo_url = body.logo_url;
      o.submit_another_form = body.submit_another_form;
      o.show_blank_form = body.show_blank_form;
      // set cache
      await NocoCache.set(key, o);
    }
    // update meta
    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.FORM_VIEW,
      {
        heading: body.heading,
        subheading: body.subheading,
        success_msg: body.success_msg,
        redirect_url: body.redirect_url,
        redirect_after_secs: body.redirect_after_secs,
        email: body.email,
        banner_image_url: body.banner_image_url,
        logo_url: body.logo_url,
        submit_another_form: body.submit_another_form,
        show_blank_form: body.show_blank_form
      },
      {
        fk_view_id: formId
      }
    );
  }

  async getColumns(ncMeta = Noco.ncMeta) {
    return (this.columns = await FormViewColumn.list(this.fk_view_id, ncMeta));
  }

  static async getWithInfo(formViewId: string, ncMeta = Noco.ncMeta) {
    const form = await this.get(formViewId, ncMeta);
    await form.getColumns(ncMeta);
    return form;
  }
}
