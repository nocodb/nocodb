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
import { NcContext, NcRequest, ViewLockType } from 'nocodb-sdk';
import type { InternalApiModule } from '~/utils/internal-type';
import { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import { INTERNAL_API_MODULE_PROVIDER_KEY } from '~/utils/internal-type';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcError } from '~/helpers/catchError';
import {
  AclMiddleware,
  VIEW_KEY,
} from '~/middlewares/extract-ids/extract-ids.middleware';
import {
  InternalGETResponseType,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { Filter, Sort, View } from '~/models';
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
    // For filter/sort operations, extract view to check personal view ownership
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
      'viewColumnUpdate',
      'hideAllColumns',
      'showAllColumns',
    ];

    if (filterSortOperations.includes(operation as string)) {
      const bypassContext = {
        workspace_id: RootScopes.BYPASS,
        base_id: RootScopes.BYPASS,
      };

      let view: View | null = null;

      // Extract view based on the operation parameters
      if (req.query.viewId) {
        view = await View.get(bypassContext, req.query.viewId as string);
      } else if (req.query.filterId) {
        const filter = await Filter.get(
          bypassContext,
          req.query.filterId as string,
        );
        if (filter?.fk_view_id) {
          view = await View.get(bypassContext, filter.fk_view_id);
        }
      } else if (req.query.sortId) {
        const sort = await Sort.get(
          bypassContext,
          req.query.sortId as string,
        );
        if (sort?.fk_view_id) {
          view = await View.get(bypassContext, sort.fk_view_id);
        }
      }

      // Set view in request for personal view ownership check in ACL middleware
      if (view && view.lock_type === ViewLockType.Personal) {
        req[VIEW_KEY] = view;
      }
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
