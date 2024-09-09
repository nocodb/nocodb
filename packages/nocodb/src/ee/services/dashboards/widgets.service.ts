import { T } from '~/utils';
import { Injectable } from '@nestjs/common';
import { DataSourceType } from 'nocodb-sdk';
import type { WidgetReqType, WidgetUpdateReqType } from 'nocodb-sdk';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import Layout from '~/models/Layout';
import Base from '~/models/Base';
import Widget from '~/models/Widget';

Injectable();
export class WidgetsService {
  static async validateWidgetDataSourceConfig(
    dataSource: null | object | string,
    layoutIdOfWidget: string,
  ) {
    const layoutOfWidget = await Layout.get(layoutIdOfWidget);
    const dashboardProject = await Base.get(layoutOfWidget.base_id);
    const linkedDbProjectIds = (
      await (dashboardProject as Base).getLinkedDbProjects()
    ).map((linkedDbProject) => linkedDbProject.id);
    const parsedDataSource =
      typeof dataSource === 'object' ? dataSource : JSON.parse(dataSource);
    if (parsedDataSource?.dataSourceType === DataSourceType.INTERNAL) {
      // TODO: ensure there are tests for this edge case
      if (
        parsedDataSource.baseId &&
        !linkedDbProjectIds.includes(parsedDataSource.baseId)
      )
        NcError.forbidden(
          `DB Base with id '${parsedDataSource.baseId}' is not linked to this Dashboard Base`,
        );
      // TODO: here we will also have to add respective entries into the table `nc_ds_widget_db_dependencies_v2`
    }
  }

  async widgetUpdate(param: {
    widgetId: string;
    widgetUpdateReq: WidgetUpdateReqType;
    req?: any;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/WidgetUpdateReq',
      param.widgetUpdateReq,
    );

    const layoutIdOfWidget = (await Widget.get(param.widgetId)).layout_id;
    WidgetsService.validateWidgetDataSourceConfig(
      param.widgetUpdateReq,
      layoutIdOfWidget,
    );
    const widget = await Widget.update(param.widgetId, param.widgetUpdateReq);

    T.emit('evt', { evt_type: 'layout:updated' });

    return widget;
  }

  async widgetDelete({ widgetId: WidgetId }: { widgetId: string }) {
    Widget.delete(WidgetId);
    T.emit('evt', {
      evt_type: 'layout_widget:deleted',
    });
    return true;
  }

  async getWidgets(param: { layoutId: string }) {
    return Widget.list({ layout_id: param.layoutId });
  }

  async widgetCreate(param: {
    layoutId: string;
    widgetReq: WidgetReqType;
    req?: any;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/WidgetReq',
      param.widgetReq,
    );

    WidgetsService.validateWidgetDataSourceConfig(
      param.widgetReq.data_source,
      param.layoutId,
    );

    const widget = await Widget.insert({
      ...param.widgetReq,
    } as any);

    T.emit('evt', { evt_type: 'widget:created' });

    return widget;
  }
}
