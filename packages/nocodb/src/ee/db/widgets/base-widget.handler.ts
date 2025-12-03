import { UITypes } from 'nocodb-sdk';
import type {
  WidgetDependencies,
  WidgetDependency,
} from 'src/db/widgets/base-widget.handler';
import type {
  AnyWidgetType,
  ColumnType,
  NcContext,
  NcRequest,
} from 'nocodb-sdk';
import { BaseUser } from '~/models';

export { WidgetDependencies, WidgetDependency };

export class BaseWidgetHandler<T extends AnyWidgetType = AnyWidgetType> {
  async validateWidgetData(
    _context: NcContext,
    _widgetData: T,
  ): Promise<any[]> {
    return [];
  }

  async getWidgetData(
    _context: NcContext,
    _params: { widget: T; req: NcRequest },
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
    widget: T,
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
      config: widget.config,
      meta: widget.meta,
      order: widget.order,
      error: true,
      position: widget.position,
      ...(mode === 'serialize' ? { id, error: true } : {}),
    };
  }

  /**
   * Extract all dependencies from widget
   * Override this in specific widget handlers for custom extraction logic
   * Returns object with arrays of column IDs, model IDs, and view IDs with their paths
   */
  public extractDependencies(_widget: T): WidgetDependencies {
    const dependencies: WidgetDependencies = {
      columns: [],
      models: [],
      views: [],
    };

    // Extract model dependency
    if (_widget.fk_model_id) {
      dependencies.models.push({
        id: _widget.fk_model_id,
        path: 'fk_model_id',
      });
    }

    // Extract view dependency
    if (_widget.fk_view_id) {
      dependencies.views.push({
        id: _widget.fk_view_id,
        path: 'fk_view_id',
      });
    }

    return dependencies;
  }
}
