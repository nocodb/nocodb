import { Injectable } from '@nestjs/common';
import { UiPostOperations as UiPostOperationsCE } from 'src/controllers/internal/modules/UiPost.operations';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { DataTableService } from '~/services/data-table.service';
import { TablesService } from '~/services/tables.service';
import { ColumnsService } from '~/services/columns.service';
import { ViewsService } from '~/services/views.service';
import { ViewColumnsService } from '~/services/view-columns.service';
import { ViewRowColorService } from '~/services/view-row-color.service';
import { FiltersService } from '~/services/filters.service';
import { SortsService } from '~/services/sorts.service';
import { HooksService } from '~/services/hooks.service';
import { GridsService } from '~/services/grids.service';
import { FormsService } from '~/services/forms.service';
import { GalleriesService } from '~/services/galleries.service';
import { KanbansService } from '~/services/kanbans.service';
import { MapsService } from '~/services/maps.service';
import { CalendarsService } from '~/services/calendars.service';

@Injectable()
export class UiPostOperations
  extends UiPostOperationsCE
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(
    protected dataTableService: DataTableService,
    protected tablesService: TablesService,
    protected columnsService: ColumnsService,
    protected viewsService: ViewsService,
    protected viewColumnsService: ViewColumnsService,
    protected viewRowColorService: ViewRowColorService,
    protected filtersService: FiltersService,
    protected sortsService: SortsService,
    protected hooksService: HooksService,
    protected gridsService: GridsService,
    protected formsService: FormsService,
    protected galleriesService: GalleriesService,
    protected kanbansService: KanbansService,
    protected mapsService: MapsService,
    protected calendarsService: CalendarsService,
  ) {
    super(
      dataTableService,
      tablesService,
      columnsService,
      viewsService,
      viewColumnsService,
      viewRowColorService,
      filtersService,
      sortsService,
      hooksService,
      gridsService,
      formsService,
      galleriesService,
      kanbansService,
      mapsService,
      calendarsService,
    );
  }

  async handle(
    context: NcContext,
    {
      payload,
      req,
      operation,
      workspaceId,
      baseId,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalPOSTResponseType {
    switch (operation) {
      case 'linkFilterCreate':
        return await this.filtersService.linkFilterCreate(context, {
          columnId: req.query.columnId,
          filter: payload,
          user: req.user,
          req,
        });
      case 'widgetFilterCreate':
        return await this.filtersService.widgetFilterCreate(context, {
          widgetId: req.query.widgetId,
          filter: payload,
          user: req.user,
          req,
        });
      case 'rowColorConditionsFilterCreate':
        return await this.filtersService.rowColorConditionsCreate(context, {
          rowColorConditionsId: req.query.rowColorConditionId,
          filter: payload,
        });
    }

    return super.handle(context, {
      workspaceId,
      baseId,
      operation,
      payload,
      req,
    });
  }
}
