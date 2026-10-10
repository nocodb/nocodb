import { Injectable } from '@nestjs/common';
import { ButtonActionsType, UITypes, validateRowFilters } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ButtonColumn } from '~/models';
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

    const row = await this.dataService.dataRead(context, {
      baseName: model.base_id,
      tableName: model.id,
      rowId: param.rowId,
      query: {},
    });
    if (!row) NcError.get(context).recordNotFound(param.rowId);

    if (
      !(await this.isButtonEnabledForRow(
        context,
        model,
        button,
        row,
        param.req,
      ))
    ) {
      NcError.get(context).badRequest(
        'This button is disabled for this record',
      );
    }

    return await this.dispatch(context, { model, button, row, ...param });
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
      metas: {},
      baseId: model.base_id,
      options: {
        currentUser: req.user?.id
          ? { id: req.user.id, email: req.user.email }
          : undefined,
      },
    });
  }

  protected async isVisibilityEnforced(_context: NcContext) {
    return true;
  }
}
