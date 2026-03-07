import { Injectable, Logger } from '@nestjs/common';
import { isLinksOrLTAR, UITypes } from 'nocodb-sdk';
import type { DateDependencyReqType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { Column, DateDependency, Model } from '~/models';

@Injectable()
export class DateDependencyService {
  protected logger = new Logger(DateDependencyService.name);

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
    },
  ): Promise<DateDependency> {
    const model = param.modelId && (await Model.get(context, param.modelId));
    if (!model) NcError.get(context).tableNotFound(param.modelId);

    await this.validateConfig(context, param.modelId, param.body);

    const existing = await DateDependency.getByModelId(context, param.modelId);

    if (existing) {
      return DateDependency.update(context, existing.id, param.body);
    }

    return DateDependency.insert(context, {
      fk_model_id: param.modelId,
      ...param.body,
    });
  }

  async delete(context: NcContext, param: { modelId: string }): Promise<void> {
    await DateDependency.deleteByModelId(context, param.modelId);
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
      if (!col || ![UITypes.Duration, UITypes.Number].includes(col.uidt as UITypes)) {
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
