import { Injectable } from '@nestjs/common';
import {
  ButtonActionsType,
  isLinksOrLTAR,
  UITypes,
  validateRowFilters,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ButtonColumn, LinkToAnotherRecordColumn } from '~/models';
import { NcError } from '~/helpers/catchError';
import { Column, Model, Source } from '~/models';
import { DatasService } from '~/services/datas.service';
import { HooksService } from '~/services/hooks.service';

/**
 * Runs a Button field click. The action is resolved from the column's own
 * config — the client only names the column and the row.
 */
@Injectable()
export class ButtonsService {
  constructor(
    protected readonly dataService: DatasService,
    protected readonly hooksService: HooksService,
  ) {}

  async buttonRun(
    context: NcContext,
    param: { columnId: string; rowId: string; req: NcRequest },
  ) {
    if (!param.columnId) {
      NcError.get(context).requiredFieldMissing('columnId');
    }
    if (!param.rowId) {
      NcError.get(context).requiredFieldMissing('rowId');
    }

    const column = await Column.get(context, { colId: param.columnId });
    if (!column || column.uidt !== UITypes.Button) {
      NcError.get(context).fieldNotFound(param.columnId);
    }

    const button = await column.getColOptions<ButtonColumn>();
    const model = await Model.get(context, column.fk_model_id);
    if (!model) NcError.get(context).tableNotFound(column.fk_model_id);

    return await this.runOnRow(context, {
      model,
      button,
      rowId: param.rowId,
      req: param.req,
    });
  }

  /** Runs a resolved button on a row, honouring its visibility condition. */
  async runOnRow(
    context: NcContext,
    {
      model,
      button,
      rowId,
      req,
    }: { model: Model; button: ButtonColumn; rowId: string; req: NcRequest },
  ) {
    const row = await this.dataService.dataRead(context, {
      baseName: model.base_id,
      tableName: model.id,
      rowId,
      query: {},
    });
    if (!row) NcError.get(context).recordNotFound(rowId);

    if (!(await this.isButtonEnabledForRow(context, model, button, row, req))) {
      NcError.get(context).badRequest(
        'This button is disabled for this record',
      );
    }

    return await this.dispatch(context, { model, button, row, rowId, req });
  }

  protected async dispatch(
    context: NcContext,
    param: {
      model: Model;
      button: ButtonColumn;
      row: Record<string, any>;
      rowId: string;
      req: NcRequest;
    },
  ): Promise<unknown> {
    switch (param.button.type) {
      case ButtonActionsType.Webhook:
        if (!param.button.fk_webhook_id) {
          NcError.get(context).hookNotFound(param.button.fk_webhook_id);
        }
        return await this.hooksService.hookTrigger(context, {
          hookId: param.button.fk_webhook_id,
          rowId: param.rowId,
          req: param.req,
        });
      default:
        NcError.get(context).badRequest(
          `Button type '${param.button.type}' cannot be run here`,
        );
    }
  }

  /** Evaluates the visibility condition the grid uses to disable the button. */
  protected async isButtonEnabledForRow(
    context: NcContext,
    model: Model,
    button: ButtonColumn,
    row: Record<string, any>,
    req: NcRequest,
  ) {
    if (!button.filters?.length) return true;
    if (!(await this.isVisibilityEnforced(context))) return true;

    const columns = await model.getColumns();
    const source = await Source.get(context, model.source_id);

    return validateRowFilters({
      filters: button.filters,
      data: row,
      columns,
      client: source?.type,
      metas: await this.relatedMetas(context, model),
      baseId: model.base_id,
      options: {
        currentUser: req.user?.id
          ? { id: req.user.id, email: req.user.email }
          : undefined,
      },
    });
  }

  /**
   * Tables reachable through link fields (two hops: lookups of lookups) — what
   * the grid has loaded when it resolves Lookup/Rollup conditions.
   */
  protected async relatedMetas(context: NcContext, model: Model) {
    const metas: Record<string, Model> = {
      [`${model.base_id}:${model.id}`]: model,
    };
    let frontier: Model[] = [model];

    for (let depth = 0; depth < 2 && frontier.length; depth++) {
      const next: Model[] = [];
      for (const table of frontier) {
        for (const column of await table.getColumns()) {
          if (!isLinksOrLTAR(column)) continue;
          const relation =
            await column.getColOptions<LinkToAnotherRecordColumn>();
          const relatedId = relation?.fk_related_model_id;
          if (
            !relatedId ||
            Object.values(metas).some((m) => m.id === relatedId)
          )
            continue;

          const related = await Model.get(context, relatedId);
          if (!related) continue;
          await related.getColumns();
          metas[`${related.base_id}:${related.id}`] = related;
          next.push(related);
        }
      }
      frontier = next;
    }

    return metas;
  }

  // CE never offers conditions and the grid ignores saved ones — so does the server.
  protected async isVisibilityEnforced(_context: NcContext) {
    return false;
  }
}
