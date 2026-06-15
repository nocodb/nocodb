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

    if (operation === 'batch') {
      return this.handleBatch(
        context,
        workspaceId,
        baseId,
        payload,
        req,
      ) as InternalPOSTResponseType;
    }

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

  /**
   * Generic batch envelope — runs many internal-API operations as a single
   * HTTP request. The envelope itself passes one outer ACL check (the
   * `batch` permission, granted to every base member). Each sub-op then
   * re-enters `checkAcl` with its own operation name so authorization is
   * enforced on a per-op basis. Sub-ops run concurrently via
   * `Promise.allSettled`, so one failure doesn't poison the rest of the
   * batch — failed entries surface as `{ status, error }` in the response.
   *
   * Response is an array in the same order as the input `operations`
   * array. Position-indexed mapping is simpler on both sides (no id
   * generation, smaller payload) and matches how the frontend batcher
   * tracks pending promises.
   */
  protected async handleBatch(
    context: NcContext,
    workspaceId: string,
    baseId: string,
    payload: { operations?: BatchSubOp[] } | null | undefined,
    req: NcRequest,
  ): Promise<{ results: BatchSubOpResult[] }> {
    const ops = payload?.operations;
    if (!Array.isArray(ops) || ops.length === 0) {
      NcError.badRequest('`operations` array is required');
    }
    if (ops.length > BATCH_MAX_SIZE) {
      NcError.badRequest(`Batch too large (max ${BATCH_MAX_SIZE} operations)`);
    }

    for (const op of ops) {
      if (!op || typeof op !== 'object') {
        NcError.badRequest('Each batched operation must be an object');
      }
      if (!op.operation || typeof op.operation !== 'string') {
        NcError.badRequest(
          'Each batched operation must have a string `operation`',
        );
      }
      // No recursive batching — keeps the failure model and timing simple.
      if (op.operation === 'batch') {
        NcError.badRequest('Nested batch is not allowed');
      }
    }

    const settled = await Promise.allSettled(
      ops.map((op) => this.runBatchedOp(context, workspaceId, baseId, op, req)),
    );

    const results: BatchSubOpResult[] = settled.map((r) => {
      if (r.status === 'fulfilled') {
        return { status: 200, data: r.value ?? null };
      }
      const err = r.reason ?? {};
      return {
        status: typeof err.code === 'number' ? err.code : 500,
        error: {
          message: err.message ?? 'Internal error',
          ...(err.error ? { error: err.error } : {}),
        },
      };
    });

    return { results };
  }

  /**
   * Run a single sub-op as if it were an independent request. We don't
   * mutate the incoming `req` — sub-ops execute concurrently, so each one
   * gets a thin clone with the sub-op's `query`/`body` merged in. The
   * original `req`'s prototype, headers, user, context, etc. flow through
   * unchanged.
   */
  protected async runBatchedOp(
    context: NcContext,
    workspaceId: string,
    baseId: string,
    subOp: BatchSubOp,
    req: NcRequest,
  ): Promise<any> {
    const operation = subOp.operation as keyof typeof OPERATION_SCOPES;
    const scope = OPERATION_SCOPES[operation];
    if (!scope) {
      NcError.notFound(`Unknown internal operation "${operation}"`);
    }

    // Object.create keeps the Express request prototype + own props intact;
    // we only shadow `query` / `body` for the sub-op.
    const subReq: NcRequest = Object.create(req);
    subReq.query = { ...(req.query ?? {}), ...(subOp.query ?? {}), operation };
    subReq.body = subOp.payload ?? {};

    // Per-sub-op authorization. `this.checkAcl` is overridable in EE so
    // license checks etc. layer on automatically through prototype dispatch.
    await this.checkAcl(operation, subReq, scope);

    const module =
      this.internalApiModuleMap['POST']?.[operation] ??
      this.internalApiModuleMap['GET']?.[operation];

    if (!module) {
      NcError.notFound(`Operation "${operation}" not registered`);
    }

    return module.handle(context, {
      workspaceId,
      baseId,
      operation,
      payload: subOp.payload,
      req: subReq,
    });
  }
}

/**
 * Public batch envelope cap. Keep this small enough that one slow sub-op
 * can't hold the others hostage for too long, and large enough that the
 * common page-load case (dashboards with ~16 widgets, view metadata with
 * ~5 ops) fits in a single round-trip.
 */
const BATCH_MAX_SIZE = 25;

interface BatchSubOp {
  operation: string;
  query?: Record<string, any>;
  payload?: any;
}

interface BatchSubOpResult {
  status: number;
  data?: any;
  error?: { message: string; error?: string };
}
