import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  DependencyTableType,
  EventType,
  isLinksOrLTAR,
  UITypes,
} from 'nocodb-sdk';
import type { DateDependencyReqType, NcRequest } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { validatePayload } from '~/helpers/apiHelpers';
import { Column, DateDependency, DependencyTracker, Model } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class DateDependencyService {
  protected logger = new Logger(DateDependencyService.name);

  constructor(protected readonly appHooksService: AppHooksService) {}

  async get(
    context: NcContext,
    param: { modelId: string },
  ): Promise<DateDependency | null> {
    return DateDependency.getByModelId(context, param.modelId);
  }

  async update(
    context: NcContext,
    param: {
      modelId: string;
      body: DateDependencyReqType;
      req: NcRequest;
    },
  ): Promise<DateDependency> {
    validatePayload(
      'swagger.json#/components/schemas/DateDependencyReq',
      param.body,
    );

    const model = param.modelId && (await Model.get(context, param.modelId));
    if (!model) NcError.get(context).tableNotFound(param.modelId);

    await this.validateConfig(context, param.modelId, param.body);

    const existing = await DateDependency.getByModelId(context, param.modelId);

    let result: DateDependency;
    const isNew = !existing;

    if (existing) {
      result = await DateDependency.update(context, existing.id, param.body);
    } else {
      result = await DateDependency.insert(context, {
        fk_model_id: param.modelId,
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

    this.appHooksService.emit(AppEvents.DATE_DEPENDENCY_UPDATE, {
      context,
      req: param.req,
      table: model,
      dateDependency: result,
      isNew,
    });

    return result;
  }

  async delete(
    context: NcContext,
    param: { modelId: string; req: NcRequest },
  ): Promise<void> {
    const model = param.modelId && (await Model.get(context, param.modelId));

    const existing = await DateDependency.getByModelId(context, param.modelId);
    if (existing?.id) {
      await DependencyTracker.clearDependencies(
        context,
        DependencyTableType.DateDependency,
        existing.id,
      );
    }
    await DateDependency.deleteByModelId(context, param.modelId);

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
      if (!col || col.uidt !== UITypes.Date) {
        NcError.get(context).badRequest(
          'Start date field must be a Date type column belonging to this table',
        );
      }
    }

    if (body.fk_end_date_field_id) {
      const col = colById.get(body.fk_end_date_field_id);
      if (!col || col.uidt !== UITypes.Date) {
        NcError.get(context).badRequest(
          'End date field must be a Date type column belonging to this table',
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

      // Load the link column options to verify it's a self-referencing HM relation
      const colOptions = await col.getColOptions<any>(context);
      if (
        colOptions?.type !== 'hm' ||
        colOptions?.fk_related_model_id !== modelId
      ) {
        NcError.get(context).badRequest(
          'Dependency linkrow field must be a self-referencing Has-Many relation on this table',
        );
      }
    }
  }
}
