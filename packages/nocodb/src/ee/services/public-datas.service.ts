import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ViewTypes, type WidgetType } from 'nocodb-sdk';
import { PublicDatasService as PublicDatasServiceCE } from 'src/services/public-datas.service';
import type { NcRequest } from 'nocodb-sdk';
import { NcContext } from '~/interface/config';
import { EEOnly } from '~/decorators/ee-only.decorator';
import { Base, Dashboard, Model, Source, View, Widget } from '~/models';
import { NcError } from '~/helpers/catchError';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { isMysqlVersionSupported } from '~/services/data-opt/mysql-helpers';
import { DataOptService } from '~/services/data-opt/data-opt.service';
import { ListDatasService } from '~/ee/services/list-datas.service';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { DatasService } from '~/services/datas.service';
import { AttachmentsService } from '~/services/attachments.service';
import { PublicMetasService } from '~/services/public-metas.service';
import { getWidgetData } from '~/db/widgets';

@Injectable()
export class PublicDatasService extends PublicDatasServiceCE {
  constructor(
    protected dataService: DatasService,
    @Inject(forwardRef(() => 'JobsService'))
    protected readonly jobsService: IJobsService,
    private readonly dataOptService: DataOptService,
    private readonly listDatasService: ListDatasService,
    protected readonly attachmentsService: AttachmentsService,
    protected readonly publicMetasService: PublicMetasService,
  ) {
    super(dataService, jobsService, attachmentsService, publicMetasService);
  }

  @EEOnly()
  async dataList(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      password?: string;
      query: any;
    },
  ) {
    const { sharedViewUuid, password } = param;
    const view = await View.getByUUID(context, sharedViewUuid);

    if (!view) NcError.viewNotFound(sharedViewUuid);

    if (view.type === ViewTypes.LIST) {
      const base = await Base.get(context, view.base_id);
      this.publicMetasService.checkViewBaseType(view, base);
      if (!(await View.verifyPassword(view, password))) {
        return NcError.invalidSharedViewPassword();
      }
      return await this.listDatasService.listViewData(context, {
        viewId: view.id,
        query: param.query,
      });
    }

    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY &&
      view.type !== ViewTypes.MAP &&
      view.type !== ViewTypes.CALENDAR &&
      view.type !== ViewTypes.TIMELINE
    ) {
      NcError.notFound('Not found');
    }

    const base = await Base.get(context, view.base_id);

    this.publicMetasService.checkViewBaseType(view, base);

    if (!(await View.verifyPassword(view, password))) {
      return NcError.invalidSharedViewPassword();
    }

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    const source = await Source.get(context, model.source_id);

    if (
      (['mysql', 'mysql2'].includes(source.type) &&
        (await isMysqlVersionSupported(context, source))) ||
      ['pg'].includes(source.type)
    ) {
      const baseModel = await Model.getBaseModelSQL(context, {
        id: model.id,
        viewId: view?.id,
        dbDriver: await NcConnectionMgrv2.get(source),
      });

      // Sanitize query params to prevent hidden column data leakage
      const visibleInfo = await this.getVisibleColumnInfo(context, view, model);
      this.sanitizeListArgsForPublicView(context, param.query, visibleInfo);

      return await this.dataOptService.list(context, {
        model,
        view,
        params: param.query,
        source,
        throwErrorIfInvalidParams: true,
        baseModel,
      });
    }
    return await super.dataList(context, param);
  }

  async dataCount(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      password?: string;
      query: any;
    },
  ) {
    const { sharedViewUuid, password } = param;
    const view = await View.getByUUID(context, sharedViewUuid);

    if (!view) NcError.viewNotFound(sharedViewUuid);

    if (view.type === ViewTypes.LIST) {
      const base = await Base.get(context, view.base_id);
      this.publicMetasService.checkViewBaseType(view, base);
      if (!(await View.verifyPassword(view, password))) {
        return NcError.invalidSharedViewPassword();
      }
      const result = await this.listDatasService.listViewCount(context, {
        viewId: view.id,
        query: param.query,
      });
      return {
        count: result.totalRows,
        ...result,
      };
    }

    return await super.dataCount(context, param);
  }

  async widgetData(
    context: NcContext,
    param: {
      sharedDashboardUuid: string;
      widgetId: string;
      password?: string;
      query: any;
      req: NcRequest;
    },
  ) {
    const { sharedDashboardUuid, widgetId, password } = param;
    const dashboard = await Dashboard.getByUUID(context, sharedDashboardUuid);

    if (!dashboard) NcError.dashboardNotFound(sharedDashboardUuid);

    const base = await Base.get(context, dashboard.base_id);

    this.publicMetasService.checkViewBaseType(dashboard, base);

    if (!(await Dashboard.verifyPassword(dashboard, password))) {
      return NcError.invalidSharedDashboardPassword();
    }

    const widget = await Widget.get(context, widgetId);

    if (!widget || widget.fk_dashboard_id !== dashboard.id) {
      NcError.widgetNotFound(widgetId);
    }

    return await getWidgetData(context, {
      widget: widget as WidgetType,
      req: param.req,
    });
  }
}
