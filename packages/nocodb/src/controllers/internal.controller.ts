import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NcContext, NcRequest } from 'nocodb-sdk';
import { markPersonalViewIfNeeded } from 'src/middlewares/extract-ids/extract-ids.helpers';
import type { InternalApiModule } from '~/utils/internal-type';
import { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import { INTERNAL_API_MODULE_PROVIDER_KEY } from '~/utils/internal-type';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcError } from '~/helpers/catchError';
import { AclMiddleware } from '~/middlewares/extract-ids/extract-ids.middleware';
import {
  InternalGETResponseType,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import {
  Filter,
  FormViewColumn,
  GridViewColumn,
  ListViewColumn,
  Sort,
  TimelineViewColumn,
  View,
} from '~/models';
import { RootScopes } from '~/utils/globals';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class InternalController {
  constructor(
    protected readonly aclMiddleware: AclMiddleware,
    @Inject(INTERNAL_API_MODULE_PROVIDER_KEY)
    protected readonly internalApiModules: InternalApiModule<any>[],
  ) {
    if (!this.internalApiModuleMap) {
      this.internalApiModuleMap = {};
    }
    for (const each of internalApiModules) {
      this.internalApiModuleMap[each.httpMethod] =
        this.internalApiModuleMap[each.httpMethod] ?? {};
      for (const operation of each.operations) {
        this.internalApiModuleMap[each.httpMethod][operation] = each;
      }
    }
  }

  protected internalApiModuleMap: Record<
    string,
    Record<string, InternalApiModule<any>>
  > = {};

  protected async checkAcl(
    operation: keyof typeof OPERATION_SCOPES,
    req: NcRequest,
    scope?: string,
  ) {
    // For filter/sort/view operations, extract view to check personal view ownership
    const filterSortOperations = [
      'filterList',
      'filterChildrenList',
      'filterCreate',
      'filterUpdate',
      'filterDelete',
      'sortList',
      'sortCreate',
      'sortUpdate',
      'sortDelete',
      'viewUpdate',
      'viewColumnUpdate',
      'viewColumnCreate',
      'hideAllColumns',
      'showAllColumns',
      'gridViewUpdate',
      'gridColumnUpdate',
      'galleryViewUpdate',
      'kanbanViewUpdate',
      'mapViewUpdate',
      'calendarViewUpdate',
      'timelineViewUpdate',
      'timelineColumnUpdate',
      'listColumnUpdate',
      'formColumnUpdate',
      'viewRowColorConditionAdd',
      'viewRowColorConditionUpdate',
      'viewRowColorConditionDelete',
      'viewRowColorSelectAdd',
      'viewRowColorInfoDelete',
      'rowColorConditionsFilterCreate',
    ];

    if (filterSortOperations.includes(operation as string)) {
      // Prefer request context over bypass to avoid stale cache reads
      const context = req.context ?? {
        workspace_id: RootScopes.BYPASS,
        base_id: RootScopes.BYPASS,
      };

      let view: View | null = null;

      // Extract view based on the operation parameters
      if (req.query.viewId) {
        view = await View.get(context, req.query.viewId as string);
      } else if (req.body?.fk_view_id) {
        // For create operations (filterCreate, sortCreate, etc.) where viewId is in body
        view = await View.get(context, req.body.fk_view_id);
      } else if (req.query.filterId) {
        const filter = await Filter.get(context, req.query.filterId as string);
        if (filter?.fk_view_id) {
          view = await View.get(context, filter.fk_view_id);
        }
      } else if (req.query.sortId) {
        const sort = await Sort.get(context, req.query.sortId as string);
        if (sort?.fk_view_id) {
          view = await View.get(context, sort.fk_view_id);
        }
      } else if (req.query.gridViewColumnId) {
        const gridCol = await GridViewColumn.get(
          context,
          req.query.gridViewColumnId as string,
        );
        if (gridCol?.fk_view_id) {
          view = await View.get(context, gridCol.fk_view_id);
        }
      } else if (req.query.timelineViewColumnId) {
        const timelineCol = await TimelineViewColumn.get(
          context,
          req.query.timelineViewColumnId as string,
        );
        if (timelineCol?.fk_view_id) {
          view = await View.get(context, timelineCol.fk_view_id);
        }
      } else if (req.query.listViewColumnId) {
        const listCol = await ListViewColumn.get(
          context,
          req.query.listViewColumnId as string,
        );
        if (listCol?.fk_view_id) {
          view = await View.get(context, listCol.fk_view_id);
        }
      } else if (req.query.formColumnId) {
        // formColumnUpdate handler reads `req.query.formColumnId` (note:
        // not the more generic `formViewColumnId` the outer extract-ids
        // middleware recognises). Handle it here so VIEW_KEY is set
        // before the editor-personal gate runs.
        const formCol = await FormViewColumn.get(
          context,
          req.query.formColumnId as string,
        );
        if (formCol?.fk_view_id) {
          view = await View.get(context, formCol.fk_view_id);
        }
      }

      // Set view in request for personal view ownership check in ACL
      // middleware. markPersonalViewIfNeeded covers both Personal and
      // Locked lock_types — the editor + locked-view gate relies on
      // VIEW_KEY being set for locked views too.
      markPersonalViewIfNeeded(req, view);
    }

    await this.aclMiddleware.aclFn(
      operation,
      {
        scope,
      },
      null,
      req,
    );
  }

  @Get(['/api/v2/internal/:workspaceId/:baseId'])
  protected async internalAPI(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Param('baseId') baseId: string,
    @Query('operation') operation: keyof typeof OPERATION_SCOPES,
    @Req() req: NcRequest,
  ): InternalGETResponseType {
    await this.checkAcl(operation, req, OPERATION_SCOPES[operation]);
    const module = this.internalApiModuleMap['GET'][operation];

    if (module) {
      return module.handle(context, {
        workspaceId,
        baseId,
        operation,
        req,
      });
    }
    return NcError.notFound('Operation');
  }

  @Post(['/api/v2/internal/:workspaceId/:baseId'])
  // return 200 instead 201 for more generic operations
  @HttpCode(200)
  protected async internalAPIPost(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Param('baseId') baseId: string,
    @Query('operation') operation: keyof typeof OPERATION_SCOPES,
    @Body() payload: any,
    @Req() req: NcRequest,
  ): InternalPOSTResponseType {
    await this.checkAcl(operation, req, OPERATION_SCOPES[operation]);

    const module = this.internalApiModuleMap['POST'][operation];

    if (module) {
      return module.handle(context, {
        workspaceId,
        baseId,
        operation,
        req,
        payload,
      });
    }
    return NcError.notFound('Operation');
  }
}
