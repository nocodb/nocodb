import { extractProps } from '../helpers/extractProps';
import { MetaTable } from '../utils/globals';
import Noco from '../Noco';
import type { LayoutReqType, LayoutType } from 'nocodb-sdk';

export default class Layout implements LayoutType {
  id?: string;
  title?: string;
  project_id?: string;
  base_id?: string;
  show: boolean;
  order: number;

  constructor(layout: Partial<LayoutType | LayoutReqType>) {
    Object.assign(this, layout);
  }

  public static async get(layoutId: string, ncMeta = Noco.ncMeta) {
    let layout;
    // TODO: Caching
    if (!layout) {
      layout = await ncMeta.metaGet2(null, null, MetaTable.LAYOUT, layoutId, [
        'id',
        'title',
        'project_id',
        'base_id',
        'show',
        'order',
      ]);
      // TODO: Caching
    }
    return layout && new Layout(layout);
  }

  static async list(
    param: {
      dashboard_id: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    let dashboards;
    // TODO: Caching
    if (!dashboards?.length) {
      dashboards = await ncMeta.metaList(
        param.dashboard_id,
        null,
        MetaTable.LAYOUT,
        {
          // condition: {
          //   fk_model_id: param.fk_model_id,
          //   // ...(param.event ? { event: param.event?.toLowerCase?.() } : {}),
          //   // ...(param.operation
          //   //   ? { operation: param.operation?.toLowerCase?.() }
          //   //   : {})
          // },
          orderBy: {
            created_at: 'asc',
          },
        },
      );

      // TODO: Caching
    }
    return dashboards?.map((h) => new Layout(h));
  }

  public static async insert(layout: Partial<Layout>, ncMeta = Noco.ncMeta) {
    const insertObj = extractProps(layout, [
      'title',
      'project_id',
      'base_id',
      'show',
      'order',
    ]);

    const { id } = await ncMeta.metaInsert2(null, null, MetaTable.LAYOUT, {
      ...insertObj,
      meta: JSON.stringify([]),
    });

    // TODO: Caching
    return this.get(id, ncMeta);
  }

  public static async update(
    dashboardId: string,
    layout: Partial<Layout>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(layout, [
      'title',
      'project_id',
      'base_id',
      'show',
      'order',
    ]);

    await ncMeta.metaUpdate(
      layout.project_id,
      null,
      MetaTable.LAYOUT,
      updateObj,
      dashboardId,
    );

    // TODO: Caching

    return this.get(layout.id, ncMeta);
  }
}
