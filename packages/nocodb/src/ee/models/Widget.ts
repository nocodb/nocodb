import { extractProps } from '../helpers/extractProps';
import { MetaTable } from '../utils/globals';
import Noco from '../Noco';
import type {
  AppearanceConfig,
  DataConfig,
  DataSource,
  WidgetReqType,
  WidgetType,
  WidgetTypeType,
} from 'nocodb-sdk';

export type JSONStringOrObject = string | Record<string, unknown> | any;

export default class Widget implements WidgetType {
  id: string;
  layout_id: string;
  schema_version: string;
  widget_type: WidgetTypeType;
  data_config?: DataConfig | JSONStringOrObject;
  data_source?: DataSource | JSONStringOrObject;
  appearance_config?: AppearanceConfig | JSONStringOrObject;

  constructor(widget: Partial<WidgetType | WidgetReqType>) {
    Object.assign(this, widget);
  }

  public static async get(widgetId: string, ncMeta = Noco.ncMeta) {
    let widget;
    // TODO: Caching
    if (!widget) {
      widget = await ncMeta.metaGet2(null, null, MetaTable.WIDGET, widgetId, [
        'id',
        'layout_id',
        'schema_version',
        'data_config',
        'data_source',
        'widget_type',
        'appearance_config',
      ]);
      // TODO: Caching
    }
    return widget && new Widget(widget);
  }

  public static async insert(widget: Partial<Widget>, ncMeta = Noco.ncMeta) {
    const insertObj = extractProps(widget, [
      'layout_id',
      'schema_version',
      'data_config',
      'data_source',
      'widget_type',
      'appearance_config',
    ]);

    const { id } = await ncMeta.metaInsert2(null, null, MetaTable.WIDGET, {
      ...insertObj,
    });

    // TODO: Caching
    return this.get(id, ncMeta);
  }

  static async delete(layoutId: string, ncMeta = Noco.ncMeta) {
    await ncMeta.metaDelete(null, null, MetaTable.WIDGET, layoutId);
    return true;
  }

  static async list(
    param: {
      layout_id: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    let widgets;
    // TODO: Caching
    if (!widgets?.length) {
      widgets = await ncMeta.metaList(null, null, MetaTable.WIDGET, {
        condition: {
          layout_id: param.layout_id,
        },
      });

      // TODO: Caching
    }
    return widgets?.map((h) => new Widget(h));
  }

  public static async update(
    widgetId: string,
    widget: Partial<Widget>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(widget, [
      'layout_id',
      'schema_version',
      'data_config',
      'data_source',
      'widget_type',
      'appearance_config',
    ]);

    const stringifiedUpdateObj = {
      ...updateObj,
      data_config: JSON.stringify(updateObj.data_config),
      appearance_config: JSON.stringify(updateObj.appearance_config),
      data_source: JSON.stringify(updateObj.data_source),
    };

    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.WIDGET,
      stringifiedUpdateObj,
      widgetId,
    );

    // TODO: Caching

    return this.get(widget.id, ncMeta);
  }
}
