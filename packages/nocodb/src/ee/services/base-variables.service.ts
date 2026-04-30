import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  BaseVariableInheritance,
  BaseVariableValueType,
  PlanFeatureTypes,
} from 'nocodb-sdk';
import type { BaseVariableReqType, BaseVariableType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { OperationName } from '~/command-registry/_op-names';
import { NcContext } from '~/interface/config';
import { Base, BaseVariable } from '~/models';
import { NcError } from '~/helpers/catchError';
import { AppHooksService } from '~/ee/services/app-hooks/app-hooks.service';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { checkForFeature } from '~/helpers/paymentHelpers';
const SECRET_MASK = '***';

@Injectable()
export class BaseVariablesService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  // ────────────────────────────────────────────
  // Base type helpers
  // ────────────────────────────────────────────

  private async getBaseFlags(
    context: NcContext,
    baseId: string,
  ): Promise<{ isSandbox: boolean; isManagedAppInstance: boolean }> {
    const base = await Base.get(context, baseId);
    if (!base) return { isSandbox: false, isManagedAppInstance: false };
    return {
      isSandbox: !!base.is_sandbox,
      isManagedAppInstance: !!base.managed_app_id && !base.managed_app_master,
    };
  }

  // ────────────────────────────────────────────
  // List
  // ────────────────────────────────────────────

  async list(context: NcContext, baseId: string): Promise<BaseVariableType[]> {
    const variables = await BaseVariable.list(context, baseId);
    const flags = await this.getBaseFlags(context, baseId);

    return variables.map((v) => this.prepareForResponse(v, flags));
  }

  /**
   * Prepare a variable for API response:
   * - Strip default_value (never returned to client)
   * - Mask values based on base type and inheritance
   */
  private prepareForResponse(
    v: BaseVariable,
    flags: { isSandbox: boolean; isManagedAppInstance: boolean },
  ): BaseVariableType {
    const { default_value: _, ...rest } = v as any;
    const result = { ...rest } as BaseVariableType;

    // Mask only when there's actually a value to hide — otherwise the GUI
    // can't distinguish "set, hidden" from "not yet configured".
    const hasValue = !!v.value;

    if (hasValue) {
      // Secret values are always masked
      if (v.type === BaseVariableValueType.SECRET) {
        result.value = SECRET_MASK;
      }
      // On managed app instances: mask fixed values and non-overridden editable values
      else if (flags.isManagedAppInstance) {
        if (v.inheritance === BaseVariableInheritance.FIXED) {
          result.value = SECRET_MASK;
        } else if (
          v.inheritance === BaseVariableInheritance.EDITABLE &&
          !v.is_overridden
        ) {
          result.value = SECRET_MASK;
        }
      }
      // Sandbox: hide production-provided values so the sandbox user can see only
      // their own overrides. Fixed inherited values and non-overridden editable
      // inherited values are masked.
      else if (flags.isSandbox) {
        if (v.inheritance === BaseVariableInheritance.FIXED && v.is_inherited) {
          result.value = SECRET_MASK;
        } else if (
          v.inheritance === BaseVariableInheritance.EDITABLE &&
          v.is_inherited &&
          !v.is_overridden
        ) {
          result.value = SECRET_MASK;
        }
      }
    }

    return result;
  }

  // ────────────────────────────────────────────
  // Create
  // ────────────────────────────────────────────

  @TraceCommand(OperationName.baseVariableCreate)
  async create(
    context: NcContext,
    param: { baseId: string; variable: BaseVariableReqType; req: NcRequest },
  ): Promise<BaseVariableType> {
    const { baseId, variable: body, req } = param;

    await checkForFeature(context, PlanFeatureTypes.FEATURE_BASE_VARIABLES);

    const flags = await this.getBaseFlags(context, baseId);

    // Managed app instances cannot create new variables
    if (flags.isManagedAppInstance) {
      NcError.badRequest('Cannot create variables on a managed app instance');
    }

    this.validateBody(body);

    // Check for duplicate key
    const existing = await BaseVariable.list(context, baseId);
    if (existing.some((v) => v.key === body.key)) {
      NcError.badRequest(`Variable with key '${body.key}' already exists`);
    }

    const variable = await BaseVariable.insert(context, {
      ...(context?.additionalContext?.is_replay && (body as any).id
        ? { id: (body as any).id }
        : {}),
      base_id: baseId,
      key: body.key,
      value: body.value,
      description: body.description,
      inheritance: body.inheritance || BaseVariableInheritance.FIXED,
      type: body.type || BaseVariableValueType.TEXT,
    });

    this.appHooksService.emit(AppEvents.BASE_VARIABLE_CREATE, {
      context,
      req,
      variable,
    });

    return this.prepareForResponse(variable, {
      isSandbox: false,
      isManagedAppInstance: false,
    });
  }

  // ────────────────────────────────────────────
  // Update
  // ────────────────────────────────────────────

  @TraceCommand(OperationName.baseVariableUpdate)
  async update(
    context: NcContext,
    param: {
      variableId: string;
      variable: Partial<BaseVariableReqType>;
      req: NcRequest;
    },
  ): Promise<BaseVariableType> {
    const { variableId, variable: body, req } = param;

    await checkForFeature(context, PlanFeatureTypes.FEATURE_BASE_VARIABLES);

    const existing = await BaseVariable.get(context, variableId);
    if (!existing) {
      NcError.genericNotFound('Variable', variableId);
    }

    const flags = await this.getBaseFlags(context, existing.base_id);

    // Sandbox: inherited fixed variables can't be edited.
    // Fresh variables (is_inherited=false, created on this sandbox) are fully editable.
    if (flags.isSandbox) {
      if (
        existing.inheritance === BaseVariableInheritance.FIXED &&
        existing.is_inherited
      ) {
        NcError.badRequest(
          'Cannot modify fixed variables inherited from production',
        );
      }
    }

    // Managed app instance: restricted editing
    if (flags.isManagedAppInstance) {
      if (existing.inheritance === BaseVariableInheritance.FIXED) {
        NcError.badRequest(
          'Cannot modify fixed variables on a managed app instance',
        );
      }

      if (
        body.inheritance !== undefined ||
        body.type !== undefined ||
        body.description !== undefined
      ) {
        NcError.badRequest(
          'Only variable values can be changed on a managed app instance',
        );
      }
    }

    // Key cannot be changed after creation
    if (body.key !== undefined && body.key !== existing.key) {
      NcError.badRequest('Variable key cannot be changed after creation');
    }

    if (
      body.inheritance &&
      !Object.values(BaseVariableInheritance).includes(body.inheritance)
    ) {
      NcError.badRequest(`Invalid inheritance: ${body.inheritance}`);
    }

    if (
      body.type &&
      !Object.values(BaseVariableValueType).includes(body.type)
    ) {
      NcError.badRequest(`Invalid type: ${body.type}`);
    }

    let updateData: Partial<BaseVariableType>;

    if (flags.isManagedAppInstance) {
      // Mark as overridden when installer changes the value
      updateData = { value: body.value, is_overridden: true };
    } else {
      updateData = {
        value: body.value,
        description: body.description,
        inheritance: body.inheritance,
        type: body.type,
        // Sandbox edits of inherited vars are local overrides — flag them so
        // prepareForResponse keeps the user's value visible (it would otherwise
        // mask editable+inherited+!overridden values).
        ...(flags.isSandbox && existing.is_inherited
          ? { is_overridden: true }
          : {}),
      };
    }

    const variable = await BaseVariable.update(context, variableId, updateData);

    this.appHooksService.emit(AppEvents.BASE_VARIABLE_UPDATE, {
      context,
      req,
      variable,
    });

    return this.prepareForResponse(variable, flags);
  }

  // ────────────────────────────────────────────
  // Revert to default
  // ────────────────────────────────────────────

  async revertToDefault(
    context: NcContext,
    variableId: string,
    req: NcRequest,
  ): Promise<BaseVariableType> {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_BASE_VARIABLES);

    const existing = await BaseVariable.get(context, variableId);
    if (!existing) {
      NcError.genericNotFound('Variable', variableId);
    }

    const flags = await this.getBaseFlags(context, existing.base_id);

    if (!flags.isManagedAppInstance) {
      NcError.badRequest(
        'Revert to default is only available on managed app instances',
      );
    }

    if (existing.inheritance === BaseVariableInheritance.FIXED) {
      NcError.badRequest('Fixed variables cannot be reverted');
    }

    if (!existing.is_overridden) {
      NcError.badRequest('Variable is already using the default value');
    }

    if (
      existing.default_value === undefined ||
      existing.default_value === null
    ) {
      NcError.badRequest('No default value available to revert to');
    }

    const variable = await BaseVariable.update(context, variableId, {
      value: existing.default_value,
      is_overridden: false,
    });

    this.appHooksService.emit(AppEvents.BASE_VARIABLE_UPDATE, {
      context,
      req,
      variable,
    });

    return this.prepareForResponse(variable, flags);
  }

  // ────────────────────────────────────────────
  // Delete
  // ────────────────────────────────────────────

  @TraceCommand(OperationName.baseVariableDelete)
  async delete(
    context: NcContext,
    param: { variableId: string; req: NcRequest },
  ): Promise<boolean> {
    const { variableId, req } = param;

    await checkForFeature(context, PlanFeatureTypes.FEATURE_BASE_VARIABLES);

    const existing = await BaseVariable.get(context, variableId);
    if (!existing) {
      NcError.genericNotFound('Variable', variableId);
    }

    const flags = await this.getBaseFlags(context, existing.base_id);

    // Managed app instances cannot delete variables
    if (flags.isManagedAppInstance) {
      NcError.badRequest('Cannot delete variables on a managed app instance');
    }

    // Sandbox: inherited fixed variables cannot be deleted
    if (
      flags.isSandbox &&
      existing.inheritance === BaseVariableInheritance.FIXED &&
      existing.is_inherited
    ) {
      NcError.badRequest(
        'Cannot delete fixed variables inherited from production',
      );
    }

    await BaseVariable.delete(context, variableId);

    this.appHooksService.emit(AppEvents.BASE_VARIABLE_DELETE, {
      context,
      req,
      variable: existing,
    });

    return true;
  }

  // ────────────────────────────────────────────
  // Bulk update
  // ────────────────────────────────────────────

  async bulkUpdate(
    context: NcContext,
    baseId: string,
    variables: { id: string; value: string }[],
    _req: NcRequest,
  ): Promise<BaseVariableType[]> {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_BASE_VARIABLES);

    const flags = await this.getBaseFlags(context, baseId);

    const results: BaseVariableType[] = [];

    for (const { id, value } of variables) {
      const existing = await BaseVariable.get(context, id);
      if (!existing || existing.base_id !== baseId) {
        continue;
      }

      // Skip fixed variables: on managed app instances always,
      // on sandbox only for inherited ones (default_value set)
      if (existing.inheritance === BaseVariableInheritance.FIXED) {
        if (flags.isManagedAppInstance) continue;
        if (flags.isSandbox && existing.is_inherited) continue;
      }

      const updateData: Partial<BaseVariableType> = flags.isManagedAppInstance
        ? { value, is_overridden: true }
        : { value };

      const updated = await BaseVariable.update(context, id, updateData);
      results.push(this.prepareForResponse(updated, flags));
    }

    return results;
  }

  // ────────────────────────────────────────────
  // Validation
  // ────────────────────────────────────────────

  private validateBody(body: BaseVariableReqType) {
    if (!body.key) {
      NcError.badRequest('Variable key is required');
    }

    if (
      body.inheritance &&
      !Object.values(BaseVariableInheritance).includes(body.inheritance)
    ) {
      NcError.badRequest(`Invalid inheritance: ${body.inheritance}`);
    }

    if (
      body.type &&
      !Object.values(BaseVariableValueType).includes(body.type)
    ) {
      NcError.badRequest(`Invalid type: ${body.type}`);
    }
  }
}
