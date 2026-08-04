import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { INTERNAL_BATCH_MAX_SIZE, NcContext, NcRequest } from 'nocodb-sdk';
import { markPersonalViewIfNeeded } from 'src/middlewares/extract-ids/extract-ids.helpers';
import type { InternalApiModule } from '~/utils/internal-type';
import { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import { INTERNAL_API_MODULE_PROVIDER_KEY } from '~/utils/internal-type';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcError } from '~/helpers/catchError';
import { mapExceptionToResponse } from '~/filters/global-exception/exception-mapper';
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
    // Enforce one HTTP method per operation name. `runBatchedOp` falls back
    // from POST → GET when looking up the dispatcher, so an operation
    // accidentally registered under both methods would resolve to the POST
    // module in batched mode and the GET module in non-batched mode —
    // silently splitting one logical operation into two code paths.
    // Failing loud at startup is cheaper than chasing that drift later.
    const opToMethod = new Map<string, string>();
    for (const each of internalApiModules) {
      this.internalApiModuleMap[each.httpMethod] =
        this.internalApiModuleMap[each.httpMethod] ?? {};
      for (const operation of each.operations) {
        const prevMethod = opToMethod.get(operation);
        if (prevMethod && prevMethod !== each.httpMethod) {
          throw new Error(
            `Internal operation "${operation}" is registered for both ` +
              `${prevMethod} and ${each.httpMethod}. Each operation must ` +
              `be bound to exactly one HTTP method so batched and ` +
              `non-batched dispatch resolve to the same handler.`,
          );
        }
        opToMethod.set(operation, each.httpMethod);
        this.internalApiModuleMap[each.httpMethod][operation] = each;
      }
      // Aggregate each module's self-declared public-base-blocked operations.
      for (const operation of each.publicBaseBlockedOperations ?? []) {
        this.publicBaseBlockedOperations.add(operation);
      }
    }
  }

  protected internalApiModuleMap: Record<
    string,
    Record<string, InternalApiModule<any>>
  > = {};

  /**
   * Operations that must be denied to public shared-base sessions, aggregated
   * from each module's `publicBaseBlockedOperations`. Consulted in `checkAcl`
   * to set `blockPublicBaseAccess` on the ACL gate — see `InternalApiModule`.
   */
  protected publicBaseBlockedOperations = new Set<
    keyof typeof OPERATION_SCOPES
  >();

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
        blockPublicBaseAccess: this.publicBaseBlockedOperations.has(operation),
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
    // batch carries sub-ops with their own scopes — base, workspace,
    // org — including workspace-scope routes with the `baseId='nc'`
    // sentinel. Enforcing a single fixed scope on the envelope itself
    // rejects valid mixed-scope batches, so short-circuit before
    // checkAcl. The per-sub-op `checkAcl` call inside handleBatch is the
    // real authorization gate; authentication is already enforced by
    // GlobalGuard above this controller.
    if (operation === 'batch') {
      return this.handleBatch(
        context,
        workspaceId,
        baseId,
        payload,
        req,
      ) as InternalPOSTResponseType;
    }

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
    if (ops.length > INTERNAL_BATCH_MAX_SIZE) {
      NcError.badRequest(
        `Batch too large (max ${INTERNAL_BATCH_MAX_SIZE} operations)`,
      );
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

    // Route each sub-op rejection through the same mapper the global
    // exception filter uses. V1 errors (Forbidden, NotFound, BadRequestV2,
    // Unauthorized, UnprocessableEntity) don't carry a numeric `code` so a
    // naive `err.code ?? 500` collapses them all to 500 — which silently
    // breaks status-aware branches on the frontend (e.g. `e.response.status
    // === 403` upgrade prompts) for any batched call. Delegating to the
    // shared mapper keeps the envelope's per-sub-op statuses identical to
    // what the same op would return through the non-batched HTTP path.
    const apiVersion = (req as any).ncApiVersion;
    const results: BatchSubOpResult[] = settled.map((r) => {
      if (r.status === 'fulfilled') {
        return { status: 200, data: r.value ?? null };
      }
      const err = r.reason;
      const mapped = mapExceptionToResponse(err, apiVersion);

      // Unhandled (default-500) sub-op errors must follow the same
      // observability path as the non-batched route — otherwise the
      // highest-frequency fan-out reads (filterList, viewColumnList,
      // columnsHash, widgetDataGet, dataAggregate…) lose Sentry capture +
      // structured logs the moment they start flowing through the batch
      // envelope. Mirror `GlobalExceptionFilter`'s side effects.
      if (mapped.unhandled) {
        this.reportSubOpException(err, req);
      }

      const body = mapped.body ?? {};
      const message =
        body.message ?? body.msg ?? err?.message ?? 'Internal error';
      const errorCode = typeof body.error === 'string' ? body.error : undefined;
      return {
        status: mapped.status,
        error: {
          message,
          ...(errorCode ? { error: errorCode } : {}),
        },
      };
    });

    return { results };
  }

  /**
   * Side-effect hook for unhandled (default-500) sub-op rejections inside
   * the batch envelope. Mirrors `GlobalExceptionFilter`'s
   * `captureException` + `logError` so monitoring stays at parity with
   * the non-batched route. Override in EE to add workspace/user context
   * and paid-workspace telemetry, matching the EE filter.
   */
  protected reportSubOpException(exception: any, _req: NcRequest) {
    Sentry.captureException(exception);
    this.logger.error(exception?.message, exception?.stack);
  }

  protected logger = new Logger(InternalController.name);

  /**
   * Run a single sub-op as if it were an independent request. We don't
   * mutate the incoming `req` — sub-ops execute concurrently, so each one
   * gets a thin clone with the sub-op's `query`/`body` merged in. The
   * original `req`'s prototype, headers, user, etc. flow through unchanged.
   *
   * IMPORTANT — concurrency contract for batchable operations:
   *
   *   Sub-ops run via `Promise.allSettled`, so anything _not_ defensively
   *   copied below is observed concurrently across siblings. We make
   *   shallow copies of `context` and `req` here, which means:
   *
   *     • Re-assigning `subContext.foo = ...` / `subReq.foo = ...` is
   *       safe (only the local copy is affected).
   *     • Mutating nested shared state — `subContext.user.x = ...`,
   *       `subReq.headers[k] = ...`, `subReq.context.x = ...` — still
   *       leaks across siblings.
   *
   *   The batchable allowlist is read-only by contract (see
   *   `BATCHABLE_INTERNAL_OPERATIONS` in nocodb-sdk). Handlers that need
   *   to write to `context` / `req` MUST NOT be added to that list.
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

    // Per-sub-op defensive copies. Shallow is enough for the current
    // read-only allowlist — see the concurrency contract above.
    const subContext: NcContext = { ...context };
    // Object.create keeps the Express request prototype + own props intact;
    // we shadow `query` / `body` for the sub-op and rely on the prototype
    // chain for everything else (user, headers, route, etc.).
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

    return module.handle(subContext, {
      workspaceId,
      baseId,
      operation,
      payload: subOp.payload,
      req: subReq,
    });
  }
}

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
