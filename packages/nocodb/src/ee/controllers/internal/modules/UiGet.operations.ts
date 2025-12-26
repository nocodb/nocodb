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
    protected commentsService: CommentsService,
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
    );
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
