import { Injectable } from '@nestjs/common';
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
import { SyncService } from '~/services/sync.service';
import { ExtensionsService } from '~/services/extensions.service';

@Injectable()
export class UiGetOperations
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
    protected syncService: SyncService,
    protected extensionsService: ExtensionsService,
  ) {}
  operations = [
    'nestedDataList' as const,
    'tableGet' as const,
    'columnsHash' as const,
    'viewList' as const,
    'viewColumnList' as const,
    'viewRowColorInfo' as const,
    'filterList' as const,
    'filterChildrenList' as const,
    'sortList' as const,
    'hookList' as const,
    'hookLogList' as const,
    'hookFilterList' as const,
    'hookSamplePayload' as const,
    'tableSampleData' as const,
    'linkFilterList' as const,
    'widgetFilterList' as const,
    'formViewGet' as const,
    'mapViewGet' as const,
    'dataAggregate' as const,
    'commentList' as const,
    'commentCount' as const,
    'dataList' as const,
    'linkDataList' as const,
    'syncSourceList' as const,
    'extensionList' as const,
    'extensionRead' as const,
  ];
  httpMethod = 'GET' as const;

  async handle(
    context: NcContext,
    {
      req,
      operation,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalGETResponseType {
    switch (operation) {
      case 'nestedDataList':
        context.cache = true;
        return await this.dataTableService.nestedDataList(context, {
          modelId: req.query.tableId as string,
          rowId: req.query.rowId as string,
          query: req.query,
          viewId: req.query.viewId as string,
          columnId: req.query.columnId as string,
          user: req.user,
        });
      case 'tableGet':
        return await this.tablesService.getTableWithAccessibleViews(context, {
          tableId: req.query.tableId,
          user: req.user,
        });
      case 'columnsHash':
        return await this.columnsService.columnsHash(
          context,
          req.query.tableId as string,
        );
      case 'viewList':
        return new PagedResponseImpl(
          await this.viewsService.viewList(context, {
            tableId: req.query.tableId as string,
            user: req.user,
          }),
        );
      case 'viewColumnList':
        return new PagedResponseImpl(
          await this.viewColumnsService.columnList(context, {
            viewId: req.query.viewId as string,
          }),
        );
      case 'viewRowColorInfo':
        return (await this.viewRowColorService.getByViewId({
          context,
          fk_view_id: req.query.viewId as string,
        })) as any;
      case 'filterList':
        return new PagedResponseImpl(
          await this.filtersService.filterList(context, {
            viewId: req.query.viewId as string,
            includeAllFilters: req.query.includeAllFilters === 'true',
          }),
        );
      case 'filterChildrenList':
        return new PagedResponseImpl(
          await this.filtersService.filterChildrenList(context, {
            filterId: req.query.filterId as string,
          }),
        );
      case 'sortList':
        return new PagedResponseImpl(
          await this.sortsService.sortList(context, {
            viewId: req.query.viewId as string,
          }),
        );
      case 'hookList':
        return new PagedResponseImpl(
          await this.hooksService.hookList(context, {
            tableId: req.query.tableId as string,
          }),
        );
      case 'hookLogList':
        return new PagedResponseImpl(
          await this.hooksService.hookLogList(context, {
            hookId: req.query.hookId as string,
            query: req.query,
          }),
          {
            ...req.query,
            count: await this.hooksService.hookLogCount(context, {
              hookId: req.query.hookId as string,
            }),
          },
        );
      case 'hookFilterList':
        return new PagedResponseImpl(
          await this.filtersService.hookFilterList(context, {
            hookId: req.query.hookId as string,
          }),
        );
      case 'hookSamplePayload':
        return await this.hooksService.hookSamplePayload(context, {
          tableId: req.query.tableId as string,
          operation: req.query.hookOperation as string,
          version: req.query.version as string,
          includeUser: req.query.includeUser === 'true',
          event: req.query.event as string,
        });
      case 'tableSampleData':
        return await this.hooksService.tableSampleData(context, {
          tableId: req.query.tableId as string,
          operation: req.query.hookOperation as any,
          version: req.query.version as any,
          includeUser: req.query.includeUser === 'true',
          event: req.query.event as any,
        });
      case 'formViewGet':
        return await this.formsService.formViewGet(context, {
          formViewId: req.query.formViewId as string,
        });
      case 'mapViewGet':
        return await this.mapsService.mapViewGet(context, {
          mapViewId: req.query.mapViewId as string,
        });
      case 'dataAggregate':
        context.cache = true;
        return await this.dataTableService.dataAggregate(context, {
          query: req.query,
          modelId: req.query.tableId as string,
          viewId: req.query.viewId as string,
          baseId: req.query.baseId as string,
          user: req.user,
        });
      case 'commentList':
        return new PagedResponseImpl(
          await this.commentsService.commentList(context, {
            query: {
              row_id: req.query.row_id as string,
              fk_model_id: req.query.fk_model_id as string,
            },
          }),
        );
      case 'commentCount':
        return await this.commentsService.commentsCount(context, {
          fk_model_id: req.query.fk_model_id as string,
          ids: Array.isArray(req.query.ids) ? req.query.ids : [req.query.ids],
        });
      case 'dataList':
        context.cache = true;
        return await this.dataTableService.dataList(context, {
          query: req.query,
          modelId: req.query.tableId as string,
          viewId: req.query.viewId as string,
          includeSortAndFilterColumns:
            req.query.includeSortAndFilterColumns === 'true',
          user: req.user,
        });
      case 'linkDataList':
        context.cache = true;
        return await this.dataTableService.getLinkedDataList(context, {
          req,
          linkColumnId: req.query.columnId as string,
        });
      case 'syncSourceList':
        return await this.syncService.syncSourceList(context, {
          baseId: context.base_id,
          sourceId: req.query.sourceId as string,
        });

      // Extensions
      case 'extensionList':
        return new PagedResponseImpl(
          await this.extensionsService.extensionList(context, {
            baseId: context.base_id,
          }),
        );
      case 'extensionRead':
        return await this.extensionsService.extensionRead(context, {
          extensionId: req.query.extensionId as string,
        });
    }
  }
}
