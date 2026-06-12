import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  DependencyTableType,
  EventType,
  isLinksOrLTAR,
  PlanFeatureTypes,
  UITypes,
} from 'nocodb-sdk';
import type { DateDependencyReqType, NcRequest } from 'nocodb-sdk';
import { OperationName } from '~/command-registry/op-names';
import { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { checkForFeature } from '~/helpers/paymentHelpers';
import { assertNotSandboxProduction } from '~/helpers/sandboxGuards';
import { validatePayload } from '~/helpers/apiHelpers';
import {
  Column,
  DateDependency,
  DependencyTracker,
  Model,
  View,
} from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import NocoSocket from '~/socket/NocoSocket';
import { TraceCommand } from '~/decorators/trace-command.decorator';
@Injectable()
export class DateDependencyService {
  protected logger = new Logger(DateDependencyService.name);

  constructor(protected readonly appHooksService: AppHooksService) {}

  async get(
    context: NcContext,
    param: { modelId: string; ganttViewId?: string },
  ): Promise<DateDependency | null> {
    if (param.ganttViewId) {
      return DateDependency.getByGanttViewId(context, param.ganttViewId);
    }
    return DateDependency.getByModelId(context, param.modelId);
  }

  @TraceCommand(OperationName.dateDependencyUpdate)
  async update(
    context: NcContext,
    param: {
      modelId: string;
      // When set, scopes the rule to a specific Gantt view (per-view rule).
      // When omitted, operates on the table's default rule (fk_gantt_view_id IS NULL).
      ganttViewId?: string;
      body: DateDependencyReqType;
      req: NcRequest;
    },
  ): Promise<DateDependency> {
    await assertNotSandboxProduction(context);

    await checkForFeature(context, PlanFeatureTypes.FEATURE_DATE_DEPENDENCY);

    // Per-view rules belong to a Gantt view, so the Gantt feature flag must
    // also be satisfied. The two flags are aligned in current plans but are
    // separate enums — keep them independently enforced so a future plan
    // mix doesn't accidentally let users mutate Gantt-owned rules.
    if (param.ganttViewId) {
      await checkForFeature(context, PlanFeatureTypes.FEATURE_GANTT_VIEW);
    }

    validatePayload(
      'swagger.json#/components/schemas/DateDependencyReq',
      param.body,
    );

    const model = param.modelId && (await Model.get(context, param.modelId));
    if (!model) NcError.get(context).tableNotFound(param.modelId);

    await this.validateConfig(context, param.modelId, param.body);

    const existing = param.ganttViewId
      ? await DateDependency.getByGanttViewId(context, param.ganttViewId)
      : await DateDependency.getByModelId(context, param.modelId);

    let result: DateDependency;
    const isNew = !existing;

    if (existing) {
      result = await DateDependency.update(context, existing.id, param.body);
    } else {
      result = await DateDependency.insert(context, {
        fk_model_id: param.modelId,
        fk_gantt_view_id: param.ganttViewId ?? null,
        ...param.body,
      });
    }

    await this.syncDependencyTracker(context, result);

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'date_dependency_update',
          payload: {
            tableId: param.modelId,
            base_id: model.base_id,
            date_dependency: result,
          },
        },
      },
      context.socket_id,
    );

    // Resolve the Gantt view identity for the audit payload — per-view
    // and table-level rules otherwise look identical in the audit log.
    const ganttView = param.ganttViewId
      ? await View.get(context, param.ganttViewId)
      : undefined;

    this.appHooksService.emit(AppEvents.DATE_DEPENDENCY_UPDATE, {
      context,
      req: param.req,
      table: model,
      ganttView: ganttView
        ? { id: ganttView.id, title: ganttView.title }
        : undefined,
      dateDependency: result,
      isNew,
    });

    return result;
  }

  @TraceCommand(OperationName.dateDependencyDelete)
  async delete(
    context: NcContext,
    param: { modelId: string; ganttViewId?: string; req: NcRequest },
  ): Promise<void> {
    await assertNotSandboxProduction(context);

    await checkForFeature(context, PlanFeatureTypes.FEATURE_DATE_DEPENDENCY);

    // Per-view rule deletes must also satisfy the Gantt feature flag —
    // see the matching gate in update() above for rationale.
    if (param.ganttViewId) {
      await checkForFeature(context, PlanFeatureTypes.FEATURE_GANTT_VIEW);
    }

    const model = param.modelId && (await Model.get(context, param.modelId));

    // Resolve view identity before the delete so the audit log can name
    // the specific Gantt view whose rule was removed (table-level
    // deletes leave this undefined).
    const ganttView = param.ganttViewId
      ? await View.get(context, param.ganttViewId)
      : undefined;

    const existing = param.ganttViewId
      ? await DateDependency.getByGanttViewId(context, param.ganttViewId)
      : await DateDependency.getByModelId(context, param.modelId);
    if (existing?.id) {
      await DependencyTracker.clearDependencies(
        context,
        DependencyTableType.DateDependency,
        existing.id,
      );
    }
    if (param.ganttViewId) {
      await DateDependency.deleteByGanttViewId(context, param.ganttViewId);
    } else {
      await DateDependency.deleteByModelId(context, param.modelId);
    }

    if (model) {
      NocoSocket.broadcastEvent(
        context,
        {
          event: EventType.META_EVENT,
          payload: {
            action: 'date_dependency_delete',
            payload: {
              tableId: param.modelId,
              base_id: model.base_id,
            },
          },
        },
        context.socket_id,
      );

      this.appHooksService.emit(AppEvents.DATE_DEPENDENCY_DELETE, {
        context,
        req: param.req,
        table: model,
        ganttView: ganttView
          ? { id: ganttView.id, title: ganttView.title }
          : undefined,
      });
    }
  }

  /**
   * Syncs the DependencyTracker with the column references used by a
   * date dependency rule so that column deletion warnings include it.
   */
  private async syncDependencyTracker(
    context: NcContext,
    rule: DateDependency,
  ): Promise<void> {
    if (!rule?.id) return;

    const columnIds = [
      rule.fk_start_date_field_id,
      rule.fk_end_date_field_id,
      rule.fk_duration_field_id,
      rule.fk_dependency_linkrow_field_id,
    ].filter(Boolean);

    await DependencyTracker.trackDependencies(
      context,
      DependencyTableType.DateDependency,
      rule.id,
      { columns: columnIds.map((id) => ({ id })) },
    );
  }

  /**
   * Validates that the specified column IDs exist on the model and are of
   * the correct UIType. Also validates self-referencing constraint on the
   * linkrow field.
   */
  private async validateConfig(
    context: NcContext,
    modelId: string,
    body: DateDependencyReqType,
  ): Promise<void> {
    const columns = await Column.list(context, { fk_model_id: modelId });
    const colById = new Map(columns.map((c) => [c.id, c]));

    if (body.fk_start_date_field_id) {
      const col = colById.get(body.fk_start_date_field_id);
      if (
        !col ||
        ![UITypes.Date, UITypes.DateTime].includes(col.uidt as UITypes)
      ) {
        NcError.get(context).badRequest(
          'Start date field must be a Date or DateTime type column belonging to this table',
        );
      }
    }

    if (body.fk_end_date_field_id) {
      const col = colById.get(body.fk_end_date_field_id);
      if (
        !col ||
        ![UITypes.Date, UITypes.DateTime].includes(col.uidt as UITypes)
      ) {
        NcError.get(context).badRequest(
          'End date field must be a Date or DateTime type column belonging to this table',
        );
      }
    }

    if (body.fk_duration_field_id) {
      const col = colById.get(body.fk_duration_field_id);
      if (
        !col ||
        ![UITypes.Duration, UITypes.Number].includes(col.uidt as UITypes)
      ) {
        NcError.get(context).badRequest(
          'Duration field must be a Duration or Number type column belonging to this table',
        );
      }
    }

    if (body.fk_dependency_linkrow_field_id) {
      const col = colById.get(body.fk_dependency_linkrow_field_id);
      if (!col || !isLinksOrLTAR(col)) {
        NcError.get(context).badRequest(
          'Dependency linkrow field must be a Links or LinkToAnotherRecord type column',
        );
      }

      // Reject system-generated inverse LTAR columns. For self-ref v2 OO
      // (and any other where the system auto-creates a counterpart), writes
      // via the inverse store the junction with flipped mm_parent/mm_child
      // relative to the canonical user-created column, which makes the cell
      // appear on the wrong row in grid views that display the canonical
      // side. Forcing dep config to point at the non-system column keeps
      // Gantt arrows + grid cell display consistent.
      if ((col as any).system) {
        NcError.get(context).badRequest(
          'Dependency linkrow field cannot be an auto-generated inverse link column. Pick the user-created link field instead.',
        );
      }

      // Load the link column options to verify it's a self-referencing HM/OM/OO relation
      // hm = Has Many (v1), om = One to Many (v2), oo = One to One
      const colOptions = await col.getColOptions<any>(context);
      if (
        !['hm', 'om', 'oo'].includes(colOptions?.type) ||
        colOptions?.fk_related_model_id !== modelId
      ) {
        NcError.get(context).badRequest(
          'Dependency linkrow field must be a self-referencing Has-Many, One-to-Many, or One-to-One relation on this table',
        );
      }
    }
  }
}
