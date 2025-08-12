import { UITypes } from 'nocodb-sdk';
import type { ColumnType, NcContext, NcRequest, WidgetType } from 'nocodb-sdk';
import { BaseUser } from '~/models';

export class BaseWidgetHandler {
  async validateWidgetData(
    _context: NcContext,
    _widgetData: WidgetType,
  ): Promise<any[]> {
    return [];
  }

  async getWidgetData(
    _context: NcContext,
    _params: { widget: WidgetType; req: NcRequest },
  ) {
    return {};
  }

  async formatValue(context: NcContext, value: any, column: ColumnType) {
    switch (column.uidt) {
      case UITypes.Checkbox:
        if (value === true || value === 'true') {
          value = 'Checked';
        } else {
          value = 'Unchecked';
        }
        break;
      case UITypes.User:
      case UITypes.CreatedBy:
      case UITypes.LastModifiedBy: {
        const users = await BaseUser.getUsersList(context, {
          base_id: context.base_id,
        });

        const user = users.find((u) => u.id === value);
        if (user) {
          value = user.display_name || user.email;
        } else {
          value = 'Deleted User';
        }
        break;
      }
    }
    return value;
  }
  async serializeOrDeserializeWidget(
    context: NcContext,
    widget: WidgetType,
    idMap: Map<string, string>,
    mode: 'serialize' | 'deserialize' = 'serialize',
  ) {
    let id;

    if (mode === 'serialize') {
      id = `${widget.base_id}::${widget.fk_dashboard_id}::${widget.id}`;
      idMap.set(widget.id, id);
    }

    return {
      title: widget.title,
      description: widget.description,
      fk_model_id: widget.fk_model_id ? idMap.get(widget.fk_model_id) : null,
      fk_view_id: widget.fk_view_id ? idMap.get(widget.fk_view_id) : null,
      fk_dashboard_id: idMap.get(`${widget.fk_dashboard_id}`),
      type: widget.type,
      config: {},
      meta: widget.meta,
      order: widget.order,
      error: true,
      position: widget.position,
      ...(mode === 'serialize' ? { id, error: true } : {}),
    };
  }
}
