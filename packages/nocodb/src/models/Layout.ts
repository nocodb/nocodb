import { extractProps } from '../helpers/extractProps';
import { MetaTable } from '../utils/globals';
import Noco from '../Noco';
import Widget from './Widget';
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

  public static async delete(layoutId: string, ncMeta = Noco.ncMeta) {
    const layout = await this.get(layoutId, ncMeta);

    await ncMeta.metaDelete(null, null, MetaTable.LAYOUT, {
      id: layoutId,
    });

    const widgetsOfLayout = await Widget.list({
      layout_id: layoutId,
    });

    for (const widget of widgetsOfLayout) {
      await Widget.delete(widget.id);
    }

    return layout;
  }

  public static async get(layoutId: string, ncMeta = Noco.ncMeta) {
    // TODO: Caching
    const layout = await ncMeta.metaGet2(
      null,
      null,
      MetaTable.LAYOUT,
      layoutId,
      [
        'id',
        'title',
        'project_id',
        'base_id',
        'show',
        'order',
        'grid_gap',
        'grid_padding_vertical',
        'grid_padding_horizontal',
      ],
    );
    return layout && new Layout(layout);
  }

  static async list(
    param: {
      dashboard_id: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    // TODO: Caching
    const layouts = await ncMeta.metaList(
      param.dashboard_id,
      null,
      MetaTable.LAYOUT,
      {
        orderBy: {
          created_at: 'asc',
        },
      },
    );

    return layouts?.map((h) => new Layout(h));
  }

  public static async insert(layout: Partial<Layout>, ncMeta = Noco.ncMeta) {
    const insertObj = extractProps(layout, [
      'title',
      'project_id',
      'base_id',
      'show',
      'order',
      'grid_gap',
      'grid_padding_vertical',
      'grid_padding_horizontal',
    ]);

    const { id } = await ncMeta.metaInsert2(null, null, MetaTable.LAYOUT, {
      ...insertObj,
      meta: JSON.stringify([]),
    });

    // TODO: Caching
    return this.get(id, ncMeta);
  }

  public static async update(
    layoutId: string,
    layout: Partial<Layout>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(layout, [
      'title',
      'project_id',
      'base_id',
      'show',
      'order',
      'grid_gap',
      'grid_padding_vertical',
      'grid_padding_horizontal',
    ]);

    await ncMeta.metaUpdate(
      layout.project_id,
      null,
      MetaTable.LAYOUT,
      updateObj,
      layoutId,
    );

    // TODO: Caching

    return this.get(layout.id, ncMeta);
  }
}
