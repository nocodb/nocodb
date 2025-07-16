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

  async getWidgetData(_params: { widget: WidgetType; req: NcRequest }) {
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
}
