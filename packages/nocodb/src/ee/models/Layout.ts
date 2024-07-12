import type { LayoutReqType, LayoutType } from 'nocodb-sdk';
import Noco from '~/Noco';

export default class Layout implements LayoutType {
  id?: string;
  title?: string;
  base_id?: string;
  source_id?: string;
  show: boolean;
  order: number;

  constructor(layout: Partial<LayoutType | LayoutReqType>) {
    Object.assign(this, layout);
  }

  public static async delete(layoutId: string, _ncMeta = Noco.ncMeta) {
    throw new Error('Not implemented');

    /* const layout = await this.get(layoutId, ncMeta);

    await ncMeta.metaDelete(context.workspace_id, context.base_id, {
      id: layoutId,
    });

    const widgetsOfLayout = await Widget.list({
      layout_id: layoutId,
    });

    for (const widget of widgetsOfLayout) {
      await Widget.delete(widget.id);
    }

    return layout; */
  }

  public static async get(layoutId: string, _ncMeta = Noco.ncMeta) {
    throw new Error('Not implemented');
    // TODO: Caching
    /* const layout = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.LAYOUT,
      layoutId,
      [
        'id',
        'title',
        'base_id',
        'source_id',
        'show',
        'order',
        'grid_gap',
        'grid_padding_vertical',
        'grid_padding_horizontal',
      ],
    );
    return layout && new Layout(layout); */
  }

  static async list(
    param: {
      dashboard_id: string;
    },
    _ncMeta = Noco.ncMeta,
  ) {
    throw new Error('Not implemented');
    // TODO: Caching
    /* const layouts = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.LAYOUT,
      {
        orderBy: {
          created_at: 'asc',
        },
      },
    );

    return layouts?.map((h) => new Layout(h)); */
  }

  public static async insert(layout: Partial<Layout>, _ncMeta = Noco.ncMeta) {
    throw new Error('Not implemented');

    /* const insertObj = extractProps(layout, [
      'title',
      'base_id',
      'source_id',
      'show',
      'order',
      'grid_gap',
      'grid_padding_vertical',
      'grid_padding_horizontal',
    ]);

    const { id } = await ncMeta.metaInsert2(context.workspace_id, context.base_id, {
      ...insertObj,
      meta: JSON.stringify([]),
    });

    // TODO: Caching
    return this.get(id, ncMeta); */
  }

  public static async update(
    layoutId: string,
    layout: Partial<Layout>,
    _ncMeta = Noco.ncMeta,
  ) {
    throw new Error('Not implemented');

    /* const updateObj = extractProps(layout, [
      'title',
      'base_id',
      'source_id',
      'show',
      'order',
      'grid_gap',
      'grid_padding_vertical',
      'grid_padding_horizontal',
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.LAYOUT,
      updateObj,
      layoutId,
    );

    // TODO: Caching

    return this.get(layout.id, ncMeta); */
  }
}
