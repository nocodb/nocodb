import { Injectable, Logger } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type {
  FilterType,
  RlsDefaultBehavior,
  RlsPolicySubjectType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import RlsPolicy from '~/ee/models/RlsPolicy';
import Filter from '~/models/Filter';
import { NcError } from '~/helpers/ncError';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class RlsService {
  protected logger: Logger = new Logger(RlsService.name);

  constructor(protected readonly appHooksService: AppHooksService) {}

  async listPolicies(
    context: NcContext,
    param: { tableId: string },
  ) {
    const policies = await RlsPolicy.listByModel(context, param.tableId);

    // Load filters for each policy
    const policiesWithFilters = await Promise.all(
      policies.map(async (policy) => {
        const filters = await Filter.rootFilterListByRlsPolicy(context, {
          rlsPolicyId: policy.id,
        });
        return { ...policy, filters };
      }),
    );

    return { list: policiesWithFilters };
  }

  async getPolicy(
    context: NcContext,
    param: { policyId: string },
  ) {
    const policy = await RlsPolicy.get(context, param.policyId);

    if (!policy) {
      NcError.genericNotFound('RLS Policy', param.policyId);
    }

    // Load filters
    const filters = await Filter.rootFilterListByRlsPolicy(context, {
      rlsPolicyId: policy.id,
    });

    return { ...policy, filters };
  }

  async createPolicy(
    context: NcContext,
    param: {
      body: {
        fk_model_id: string;
        title?: string;
        is_default?: boolean;
        default_behavior?: RlsDefaultBehavior;
        subjects?: RlsPolicySubjectType[];
        filters?: any[];
      };
      userId: string;
      req: NcRequest;
    },
  ) {
    const { body, userId, req } = param;

    // If creating a default policy, check if one already exists
    if (body.is_default) {
      const existingDefault = await RlsPolicy.getDefaultPolicy(
        context,
        body.fk_model_id,
      );
      if (existingDefault) {
        NcError.badRequest(
          'A default policy already exists for this table. Update or delete it first.',
        );
      }
    }

    // Create the policy
    const policy = await RlsPolicy.insert(context, {
      base_id: context.base_id,
      fk_model_id: body.fk_model_id,
      title: body.title || (body.is_default ? 'Default Policy' : 'New Policy'),
      enabled: true,
      is_default: body.is_default || false,
      default_behavior: body.is_default
        ? body.default_behavior || 'show_all'
        : undefined,
      created_by: userId,
    });

    // Set subjects if provided (not for default policy)
    if (body.subjects && body.subjects.length > 0 && !body.is_default) {
      await RlsPolicy.setSubjects(context, policy.id, body.subjects);
    }

    // Create filters if provided
    if (body.filters && body.filters.length > 0) {
      for (const filterData of body.filters) {
        await Filter.insert(context, {
          ...filterData,
          fk_rls_policy_id: policy.id,
          base_id: context.base_id,
        });
      }
    }

    this.appHooksService.emit(AppEvents.RLS_POLICY_CREATE, {
      userId,
      req,
      policyId: policy.id,
      policyTitle: policy.title || '',
      tableId: body.fk_model_id,
    });

    return this.getPolicy(context, { policyId: policy.id });
  }

  async updatePolicy(
    context: NcContext,
    param: {
      body: {
        id: string;
        title?: string;
        enabled?: boolean;
        default_behavior?: RlsDefaultBehavior;
        order?: number;
      };
      userId: string;
      req: NcRequest;
    },
  ) {
    const { body, userId, req } = param;

    const policy = await RlsPolicy.get(context, body.id);

    if (!policy) {
      NcError.genericNotFound('RLS Policy', body.id);
    }

    await RlsPolicy.update(context, body.id, {
      title: body.title,
      enabled: body.enabled,
      default_behavior: body.default_behavior,
      order: body.order,
    });

    this.appHooksService.emit(AppEvents.RLS_POLICY_UPDATE, {
      userId,
      req,
      policyId: body.id,
      policyTitle: body.title || policy.title || '',
    });

    return this.getPolicy(context, { policyId: body.id });
  }

  async deletePolicy(
    context: NcContext,
    param: {
      policyId: string;
      userId: string;
      req: NcRequest;
    },
  ) {
    const { policyId, userId, req } = param;

    const policy = await RlsPolicy.get(context, policyId);

    if (!policy) {
      NcError.genericNotFound('RLS Policy', policyId);
    }

    // Delete associated filters first
    await Filter.deleteAllByRlsPolicy(context, policyId);

    // Delete the policy (also deletes subjects)
    await RlsPolicy.delete(context, policyId);

    this.appHooksService.emit(AppEvents.RLS_POLICY_DELETE, {
      userId,
      req,
      policyId,
      tableId: policy.fk_model_id,
    });

    return { success: true };
  }

  async setSubjects(
    context: NcContext,
    param: {
      policyId: string;
      subjects: RlsPolicySubjectType[];
      req: NcRequest;
    },
  ) {
    const { policyId, subjects } = param;

    const policy = await RlsPolicy.get(context, policyId);

    if (!policy) {
      NcError.genericNotFound('RLS Policy', policyId);
    }

    if (policy.is_default) {
      NcError.badRequest('Cannot set subjects on the default policy.');
    }

    await RlsPolicy.setSubjects(context, policyId, subjects);

    // Invalidate model cache since policy subjects changed
    await RlsPolicy.clearModelCache(context, policy.fk_model_id);

    return this.getPolicy(context, { policyId });
  }

  async createFilter(
    context: NcContext,
    param: {
      body: Partial<FilterType> & { fk_rls_policy_id: string };
      req: NcRequest;
    },
  ) {
    const { body } = param;

    const policy = await RlsPolicy.get(context, body.fk_rls_policy_id);

    if (!policy) {
      NcError.genericNotFound('RLS Policy', body.fk_rls_policy_id);
    }

    const filter = await Filter.insert(context, {
      ...body,
      base_id: context.base_id,
    });

    // Invalidate model cache
    await RlsPolicy.clearModelCache(context, policy.fk_model_id);

    return filter;
  }

  async updateFilter(
    context: NcContext,
    param: {
      body: Partial<FilterType> & { id: string };
      req: NcRequest;
    },
  ) {
    const filter = await Filter.update(context, param.body.id, param.body);

    return filter;
  }

  async deleteFilter(
    context: NcContext,
    param: {
      filterId: string;
      req: NcRequest;
    },
  ) {
    await Filter.delete(context, param.filterId);

    return { success: true };
  }
}
