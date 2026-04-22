import { Injectable } from '@nestjs/common';
import { UiGetOperations as UiGetOperationsCE } from 'src/controllers/internal/modules/UiGet.operations';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { DataTableService } from '~/services/data-table.service';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { TablesService } from '~/services/tables.service';
import { ColumnsService } from '~/services/columns.service';
import { ViewsService } from '~/services/views.service';
import { ViewColumnsService } from '~/services/view-columns.service';
import { ViewRowColorService } from '~/services/view-row-color.service';
import { FiltersService } from '~/services/filters.service';
import { SortsService } from '~/services/sorts.service';
import { HooksService } from '~/services/hooks.service';
import { FormsService } from '~/services/forms.service';
import { MapsService } from '~/services/maps.service';
import { CommentsService } from '~/services/comments.service';
import { ListDatasService } from '~/ee/services/list-datas.service';
import { SyncService } from '~/services/sync.service';
import { ExtensionsService } from '~/services/extensions.service';
import { DateDependencyService } from '~/services/date-dependency.service';

@Injectable()
export class UiGetOperations
  extends UiGetOperationsCE
  implements InternalApiModule<InternalGETResponseType>
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
    protected formsService: FormsService,
    protected mapsService: MapsService,
    protected listDatasService: ListDatasService,
    protected commentsService: CommentsService,
    protected syncService: SyncService,
    protected extensionsService: ExtensionsService,
    protected dateDependencyService: DateDependencyService,
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
      formsService,
      mapsService,
      commentsService,
      syncService,
      extensionsService,
    );

    (this.operations as string[]) = [...this.operations, 'getDateDependency'];
  }

  async handle(
    context: NcContext,
    {
      req,
      operation,
      workspaceId,
      baseId,
      payload,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalGETResponseType {
    switch (operation) {
      case 'linkFilterList':
        return new PagedResponseImpl(
          await this.filtersService.linkFilterList(context, {
            columnId: req.query.columnId as string,
          }),
        );
      case 'widgetFilterList':
        return new PagedResponseImpl(
          await this.filtersService.widgetFilterList(context, {
            widgetId: req.query.widgetId as string,
          }),
        );
      case 'listViewDataCount': {
        context.cache = true;
        return await this.listDatasService.listViewCount(context, {
          viewId: req.query.viewId as string,
          query: req.query,
        });
      }
      case 'listViewDataList':
        context.cache = true;
        return await this.listDatasService.listViewData(context, {
          viewId: req.query.viewId as string,
          query: req.query,
        });
      case 'buttonFilterList':
        return new PagedResponseImpl(
          await this.filtersService.buttonFilterList(context, {
            buttonColId: req.query.buttonColId as string,
          }),
        );
      case 'getDateDependency':
        return this.dateDependencyService.get(context, {
          modelId: (req.query.fk_model_id || req.query.modelId) as string,
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
