import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import type { DataExportJobData } from '~/interface/Jobs';
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
import { GridColumnsService } from '~/services/grid-columns.service';
import { FormsService } from '~/services/forms.service';
import { FormColumnsService } from '~/services/form-columns.service';
import { GalleriesService } from '~/services/galleries.service';
import { KanbansService } from '~/services/kanbans.service';
import { MapsService } from '~/services/maps.service';
import { CalendarsService } from '~/services/calendars.service';
import { CommentsService } from '~/services/comments.service';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { SyncService } from '~/services/sync.service';
import { SyncSource, View } from '~/models';
import { NcError } from '~/helpers/catchError';
import { JobTypes } from '~/interface/Jobs';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { ExtensionsService } from '~/services/extensions.service';

@Injectable()
export class UiPostOperations
  implements InternalApiModule<InternalPOSTResponseType> {
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
    protected gridColumnsService: GridColumnsService,
    protected formsService: FormsService,
    protected formColumnsService: FormColumnsService,
    protected galleriesService: GalleriesService,
    protected kanbansService: KanbansService,
    protected mapsService: MapsService,
    protected calendarsService: CalendarsService,
    protected commentsService: CommentsService,
    protected bulkDataAliasService: BulkDataAliasService,
    protected syncService: SyncService,
    protected readonly nocoJobsService: NocoJobsService,
    protected extensionsService: ExtensionsService,
  ) { }
  operations = [
    'tableUpdate' as const,
    'tableDelete' as const,
    'tableReorder' as const,
    'columnAdd' as const,
    'columnUpdate' as const,
    'columnDelete' as const,
    'columnSetAsPrimary' as const,
    'columnsBulk' as const,
    'viewUpdate' as const,
    'viewDelete' as const,
    'shareView' as const,
    'shareViewUpdate' as const,
    'shareViewDelete' as const,
    'showAllColumns' as const,
    'hideAllColumns' as const,
    'viewColumnUpdate' as const,
    'viewColumnCreate' as const,
    'gridColumnUpdate' as const,
    'viewRowColorConditionAdd' as const,
    'viewRowColorConditionUpdate' as const,
    'viewRowColorConditionDelete' as const,
    'viewRowColorSelectAdd' as const,
    'viewRowColorInfoDelete' as const,
    'filterCreate' as const,
    'filterUpdate' as const,
    'filterDelete' as const,
    'sortCreate' as const,
    'sortUpdate' as const,
    'sortDelete' as const,
    'hookCreate' as const,
    'hookUpdate' as const,
    'hookDelete' as const,
    'hookTest' as const,
    'hookTrigger' as const,
    'hookFilterCreate' as const,
    'gridViewCreate' as const,
    'formViewCreate' as const,
    'galleryViewCreate' as const,
    'kanbanViewCreate' as const,
    'mapViewCreate' as const,
    'calendarViewCreate' as const,
    'gridViewUpdate' as const,
    'formViewUpdate' as const,
    'formColumnUpdate' as const,
    'galleryViewUpdate' as const,
    'kanbanViewUpdate' as const,
    'mapViewUpdate' as const,
    'calendarViewUpdate' as const,
    'nestedDataLink' as const,
    'nestedDataUnlink' as const,
    'nestedDataListCopyPasteOrDeleteAll' as const,
    'linkFilterCreate' as const,
    'widgetFilterCreate' as const,
    'rowColorConditionsFilterCreate' as const,
    'bulkAggregate' as const,
    'bulkDataList' as const,
    'dataInsert' as const,
    'dataUpdate' as const,
    'dataDelete' as const,
    'bulkDataDeleteAll' as const,
    'commentRow' as const,
    'commentUpdate' as const,
    'commentDelete' as const,
    'commentResolve' as const,
    'syncSourceCreate' as const,
    'syncSourceUpdate' as const,
    'syncSourceDelete' as const,
    'atImportTrigger' as const,
    'dataExport' as const,
    'extensionCreate' as const,
    'extensionUpdate' as const,
    'extensionDelete' as const,
  ];
  httpMethod = 'POST' as const;

  async handle(
    context: NcContext,
    {
      payload,
      req,
      operation,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalPOSTResponseType {
    switch (operation) {
      case 'tableUpdate':
        return await this.tablesService.tableUpdate(context, {
          tableId: req.query.tableId,
          table: payload,
          user: req.user,
          req,
        });
      case 'tableDelete':
        return await this.tablesService.tableDelete(context, {
          tableId: req.query.tableId,
          user: req.user,
          forceDeleteRelations: payload?.forceDeleteRelations,
          req,
        });
      case 'tableReorder':
        return await this.tablesService.reorderTable(context, {
          tableId: req.query.tableId,
          order: payload.order,
          req,
        });
      case 'columnAdd':
        return await this.columnsService.columnAdd(context, {
          tableId: req.query.tableId,
          column: payload,
          user: req.user,
          req,
        });
      case 'columnUpdate':
        return await this.columnsService.columnUpdate(context, {
          columnId: req.query.columnId,
          column: payload,
          user: req.user,
          req,
        });
      case 'columnDelete':
        return await this.columnsService.columnDelete(context, {
          columnId: req.query.columnId,
          user: req.user,
          req,
        });
      case 'columnSetAsPrimary':
        return await this.columnsService.columnSetAsPrimary(context, {
          columnId: req.query.columnId,
          req,
        });
      case 'columnsBulk':
        return await this.columnsService.columnBulk(
          context,
          req.query.tableId,
          payload,
          req,
        );
      case 'viewUpdate':
        return await this.viewsService.viewUpdate(context, {
          viewId: req.query.viewId,
          view: payload,
          user: req.user,
          req,
        });
      case 'viewDelete':
        return await this.viewsService.viewDelete(context, {
          viewId: req.query.viewId,
          user: req.user,
          req,
        });
      case 'shareView':
        return await this.viewsService.shareView(context, {
          viewId: req.query.viewId,
          user: req.user,
          req,
        });
      case 'shareViewUpdate':
        return await this.viewsService.shareViewUpdate(context, {
          viewId: req.query.viewId,
          sharedView: payload,
          user: req.user,
          req,
        });
      case 'shareViewDelete':
        return await this.viewsService.shareViewDelete(context, {
          viewId: req.query.viewId,
          user: req.user,
          req,
        });
      case 'showAllColumns':
        return await this.viewsService.showAllColumns(context, {
          viewId: req.query.viewId,
          ignoreIds: req.query.ignoreIds,
        });
      case 'hideAllColumns':
        return await this.viewsService.hideAllColumns(context, {
          viewId: req.query.viewId,
          ignoreIds: req.query.ignoreIds,
        });
      case 'viewColumnUpdate':
        return await this.viewColumnsService.columnUpdate(context, {
          viewId: req.query.viewId,
          columnId: req.query.columnId,
          column: payload,
          req,
        });
      case 'gridColumnUpdate':
        return await this.gridColumnsService.gridColumnUpdate(context, {
          gridViewColumnId: req.query.gridViewColumnId,
          grid: payload,
          req,
        });
      case 'viewColumnCreate':
        return await this.viewColumnsService.columnAdd(context, {
          viewId: req.query.viewId,
          column: payload,
          req,
        });
      case 'viewRowColorConditionAdd':
        return await this.viewRowColorService.addRowColoringCondition({
          context,
          fk_view_id: req.query.viewId,
          color: payload.color,
          is_set_as_background: payload.is_set_as_background,
          nc_order: payload.nc_order,
          filter: payload.filter,
        });
      case 'viewRowColorConditionUpdate':
        return await this.viewRowColorService.updateRowColoringCondition({
          context,
          fk_view_id: req.query.viewId,
          fk_row_coloring_conditions_id: req.query.rowColorConditionId,
          color: payload.color,
          is_set_as_background: payload.is_set_as_background,
          nc_order: payload.nc_order,
        });
      case 'viewRowColorConditionDelete':
        return await this.viewRowColorService.deleteRowColoringCondition({
          context,
          fk_view_id: req.query.viewId,
          fk_row_coloring_conditions_id: req.query.rowColorConditionId,
        });
      case 'viewRowColorSelectAdd':
        return await this.viewRowColorService.setRowColoringSelect({
          context,
          fk_view_id: req.query.viewId,
          fk_column_id: payload.fk_column_id,
          is_set_as_background: payload.is_set_as_background,
        });
      case 'viewRowColorInfoDelete':
        return await this.viewRowColorService.removeRowColorInfo({
          context,
          fk_view_id: req.query.viewId,
        });
      case 'filterCreate':
        return await this.filtersService.filterCreate(context, {
          viewId: req.query.viewId,
          filter: payload,
          user: req.user,
          req,
        });
      case 'filterUpdate':
        return await this.filtersService.filterUpdate(context, {
          filterId: req.query.filterId,
          filter: payload,
          user: req.user,
          req,
        });
      case 'filterDelete':
        return await this.filtersService.filterDelete(context, {
          filterId: req.query.filterId,
          req,
        });
      case 'sortCreate':
        return await this.sortsService.sortCreate(context, {
          viewId: req.query.viewId,
          sort: payload,
          req,
        });
      case 'sortUpdate':
        return await this.sortsService.sortUpdate(context, {
          sortId: req.query.sortId,
          sort: payload,
          req,
        });
      case 'sortDelete':
        return await this.sortsService.sortDelete(context, {
          sortId: req.query.sortId,
          req,
        });
      case 'hookCreate':
        return await this.hooksService.hookCreate(context, {
          tableId: req.query.tableId,
          hook: payload,
          req,
        });
      case 'hookUpdate':
        return await this.hooksService.hookUpdate(context, {
          hookId: req.query.hookId,
          hook: payload,
          req,
        });
      case 'hookDelete':
        return await this.hooksService.hookDelete(context, {
          hookId: req.query.hookId,
          req,
        });
      case 'hookTest':
        return await this.hooksService.hookTest(context, {
          hookTest: {
            ...payload,
            payload: {
              ...payload.payload,
              user: req.user,
            },
          },
          tableId: req.query.tableId,
          req,
        });
      case 'hookTrigger':
        return await this.hooksService.hookTrigger(context, {
          hookId: req.query.hookId as string,
          rowId: req.query.rowId as string,
          req,
        });
      case 'hookFilterCreate':
        return await this.filtersService.hookFilterCreate(context, {
          hookId: req.query.hookId,
          filter: payload,
          user: req.user,
          req,
        });
      case 'gridViewCreate':
        return await this.gridsService.gridViewCreate(context, {
          grid: payload,
          tableId: req.query.tableId,
          req,
        });
      case 'formViewCreate':
        return await this.formsService.formViewCreate(context, {
          body: payload,
          tableId: req.query.tableId,
          user: req.user,
          req,
        });
      case 'galleryViewCreate':
        return await this.galleriesService.galleryViewCreate(context, {
          gallery: payload,
          tableId: req.query.tableId,
          user: req.user,
          req,
        });
      case 'kanbanViewCreate':
        return await this.kanbansService.kanbanViewCreate(context, {
          kanban: payload,
          tableId: req.query.tableId,
          user: req.user,
          req,
        });
      case 'mapViewCreate':
        return await this.mapsService.mapViewCreate(context, {
          map: payload,
          tableId: req.query.tableId,
          user: req.user,
          req,
        });
      case 'calendarViewCreate':
        return await this.calendarsService.calendarViewCreate(context, {
          calendar: payload,
          tableId: req.query.tableId,
          user: req.user,
          req,
        });
      case 'gridViewUpdate':
        return await this.gridsService.gridViewUpdate(context, {
          viewId: req.query.viewId,
          grid: payload,
          req,
        });
      case 'formViewUpdate':
        return await this.formsService.formViewUpdate(context, {
          formViewId: req.query.viewId,
          form: payload,
          req,
        });
      case 'formColumnUpdate':
        return await this.formColumnsService.columnUpdate(context, {
          formViewColumnId: req.query.formColumnId,
          formViewColumn: payload,
          req,
        });
      case 'galleryViewUpdate':
        return await this.galleriesService.galleryViewUpdate(context, {
          galleryViewId: req.query.viewId,
          gallery: payload,
          req,
        });
      case 'kanbanViewUpdate':
        return await this.kanbansService.kanbanViewUpdate(context, {
          kanbanViewId: req.query.viewId,
          kanban: payload,
          req,
        });
      case 'mapViewUpdate':
        return await this.mapsService.mapViewUpdate(context, {
          mapViewId: req.query.viewId,
          map: payload,
          req,
        });
      case 'calendarViewUpdate':
        return await this.calendarsService.calendarViewUpdate(context, {
          calendarViewId: req.query.viewId,
          calendar: payload,
          req,
        });
      case 'nestedDataLink':
        return await this.dataTableService.nestedLink(context, {
          modelId: req.query.tableId as string,
          rowId: req.query.rowId as string,
          query: req.query,
          viewId: req.query.viewId as string,
          columnId: req.query.columnId as string,
          refRowIds: payload,
          cookie: req,
          user: req.user,
        });
      case 'nestedDataUnlink':
        return await this.dataTableService.nestedUnlink(context, {
          modelId: req.query.tableId as string,
          rowId: req.query.rowId as string,
          query: req.query,
          viewId: req.query.viewId as string,
          columnId: req.query.columnId as string,
          refRowIds: payload,
          cookie: req,
          user: req.user,
        });
      case 'nestedDataListCopyPasteOrDeleteAll':
        return await this.dataTableService.nestedListCopyPasteOrDeleteAll(
          context,
          {
            modelId: req.query.tableId as string,
            query: req.query,
            viewId: req.query.viewId as string,
            columnId: req.query.columnId as string,
            data: payload,
            cookie: req,
            user: req.user,
          },
        );
      case 'bulkAggregate':
        context.cache = true;
        return await this.dataTableService.bulkAggregate(context, {
          query: req.query,
          modelId: req.query.tableId as string,
          viewId: req.query.viewId as string,
          baseId: req.query.baseId as string,
          body: payload,
        });
      case 'bulkDataList':
        return await this.dataTableService.bulkDataList(context, {
          query: req.query,
          modelId: req.query.tableId as string,
          viewId: req.query.viewId as string,
          baseId: req.query.baseId as string,
          body: payload,
          user: req.user,
        });
      case 'dataExport': {
        const view = await View.get(context, req.query.viewId);

        if (!view) NcError.viewNotFound(req.query.viewId);
        const options: DataExportJobData['options'] = payload.options ?? {};

        const job = await this.nocoJobsService.add(JobTypes.DataExport, {
          context,
          options: {
            ...options,
            // includeByteOrderMark when export is triggered from controller
            includeByteOrderMark: true,
          },
          modelId: view.fk_model_id,
          viewId: req.query.viewId,
          user: req.user,
          exportAs: payload.exportAs,
          ncSiteUrl: req.ncSiteUrl,
        });

        return {
          id: job.id,
          name: job.name,
        };
      }
      case 'dataInsert':
        return await this.dataTableService.dataInsert(context, {
          modelId: req.query.tableId as string,
          body: payload,
          viewId: req.query.viewId as string,
          cookie: req,
          undo: req.query.undo === 'true',
          user: req.user,
        });
      case 'dataUpdate':
        return await this.dataTableService.dataUpdate(context, {
          modelId: req.query.tableId as string,
          body: payload,
          viewId: req.query.viewId as string,
          cookie: req,
          user: req.user,
        });
      case 'dataDelete':
        return await this.dataTableService.dataDelete(context, {
          modelId: req.query.tableId as string,
          cookie: req,
          viewId: req.query.viewId as string,
          body: payload,
          user: req.user,
        });
      case 'bulkDataDeleteAll':
        return await this.bulkDataAliasService.bulkDataDeleteAll(context, {
          baseName: context.base_id,
          tableName: req.query.tableId!,
          query: req.query,
          viewName: req.query.viewId,
          req,
        });

      case 'commentRow':
        return await this.commentsService.commentRow(context, {
          body: payload,
          user: req.user,
          req,
        });
      case 'commentUpdate':
        return await this.commentsService.commentUpdate(context, {
          commentId: payload.commentId,
          user: req.user,
          body: payload,
          req,
        });
      case 'commentDelete':
        return await this.commentsService.commentDelete(context, {
          commentId: payload.commentId,
          user: req.user,
          req,
        });
      case 'syncSourceCreate':
        return await this.syncService.syncCreate(context, {
          baseId: context.base_id,
          sourceId: req.query.sourceId as string,
          userId: (req as any).user.id,
          syncPayload: payload,
          req,
        });
      case 'syncSourceUpdate':
        return await this.syncService.syncUpdate(context, {
          syncId: req.query.syncId as string,
          syncPayload: payload,
          req,
        });
      case 'syncSourceDelete':
        return await this.syncService.syncDelete(context, {
          syncId: req.query.syncId as string,
          req,
        });
      case 'atImportTrigger': {
        const jobs = await this.nocoJobsService.getJobList();
        const fnd = jobs.find((j) => j.data.syncId === req.query.syncId);

        if (fnd) {
          NcError.badRequest('Sync already in progress');
        }

        const syncSource = await SyncSource.get(
          context,
          req.query.syncId as string,
        );

        const user = await syncSource.getUser();

        // Treat default baseUrl as siteUrl from req object
        let baseURL = (req as any).ncSiteUrl;

        // if environment value avail use it
        // or if it's docker construct using `PORT`
        if (process.env.NC_DOCKER) {
          baseURL = `http://localhost:${process.env.PORT || 8080}`;
        }

        const job = await this.nocoJobsService.add(JobTypes.AtImport, {
          context,
          syncId: req.query.syncId as string,
          ...(syncSource?.details || {}),
          baseId: syncSource.base_id,
          sourceId: syncSource.source_id,
          authToken: '',
          baseURL,
          user: user,
        });

        return { id: job.id };
      }
      case 'extensionCreate':
        return await this.extensionsService.extensionCreate(context, {
          extension: payload,
          req,
        });
      case 'extensionUpdate':
        return await this.extensionsService.extensionUpdate(context, {
          extensionId: req.query.extensionId,
          extension: payload,
          req,
        });
      case 'extensionDelete':
        return await this.extensionsService.extensionDelete(context, {
          extensionId: req.query.extensionId,
          req,
        });
    }
  }
}
