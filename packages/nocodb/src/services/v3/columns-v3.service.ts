import { Injectable } from '@nestjs/common';
import {
  enumColors,
  isLinksOrLTAR,
  LinksVersion,
  NcApiVersion,
  UITypes,
  WebhookActions,
} from 'nocodb-sdk';
import type {
  ColumnReqType,
  FieldOptionAddItemV3Type,
  FieldOptionDeleteItemV3Type,
  FieldUpdateV3Type,
  FieldV3Type,
  UserType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ReusableParams } from '~/services/columns.service';
import { NcError } from '~/helpers/ncError';
import {
  type ColumnWebhookManager,
  ColumnWebhookManagerBuilder,
} from '~/utils/column-webhook-manager';
import { ColumnsService } from '~/services/columns.service';
import { Column } from '~/models';
import Noco from '~/Noco';
import {
  columnBuilder,
  columnV3ToV2Builder,
} from '~/utils/api-v3-data-transformation.builder';
import { validatePayload } from '~/helpers';

type ColumnReqWithMeta = ColumnReqType & {
  meta?: any;
  colOptions?: any;
  dtxp?: string;
};

type SelectChoiceV3 = { id?: string; title: string; color?: string };

@Injectable()
export class ColumnsV3Service {
  constructor(protected readonly columnsService: ColumnsService) {}

  async columnUpdate(
    context: NcContext,
    param: {
      req: any;
      columnId: string;
      column: FieldUpdateV3Type;
      cookie?: any;
      user: UserType;
      reuse?: ReusableParams;
      columnWebhookManager?: ColumnWebhookManager;
    },
    ncMeta = Noco.ncMeta,
  ) {
    validatePayload(
      'swagger-v3.json#/components/schemas/FieldUpdate',
      param.column,
      true,
      context,
    );

    if (param.column.type) {
      validatePayload(
        `swagger-v3.json#/components/schemas/FieldOptions/${param.column.type}`,
        param.column,
        true,
        context,
      );
    }

    let column = await Column.get(context, { colId: param.columnId }, ncMeta);

    if (!column) {
      NcError.get(context).fieldNotFound(param.columnId);
    }

    const columnWebhookManager =
      param.columnWebhookManager ??
      (
        await new ColumnWebhookManagerBuilder(context, ncMeta).withModelId(
          column.fk_model_id,
        )
      )
        .addColumn(column)
        .forUpdate();

    const type = (param.column?.type ?? column.uidt) as FieldV3Type['type'];

    const processedColumnReq = columnV3ToV2Builder().build({
      ...param.column,
      type,
    } as FieldV3Type) as ColumnReqWithMeta;

    // The v2 update path needs a full identity for the column; backfilling the
    // stored title/column_name is a no-op there, since it diffs submitted
    // values against the stored ones rather than reading the payload's keys.
    if (!processedColumnReq.column_name) {
      processedColumnReq.column_name = column.column_name;
    }
    if (!processedColumnReq.title) {
      processedColumnReq.title = column.title;
    }

    if ([UITypes.SingleSelect, UITypes.MultiSelect].includes(column.uidt)) {
      if (column.meta) {
        column.meta.choices = undefined;
      }
      column.dtxp = (column.colOptions as unknown as { options: any[] })?.options
        ?.map((o: any) => `'${o.value}'`)
        .join('');
    }

    // in payload id is required in existing implementation
    column.id = param.columnId;
    await this.columnsService.columnUpdate(
      context,
      {
        ...param,
        column: processedColumnReq,
        apiVersion: NcApiVersion.V3,
        req: param.req,
        columnWebhookManager: columnWebhookManager,
      },
      ncMeta,
    );

    column = await Column.get(context, { colId: param.columnId });

    // do tranformation
    const v3Response = columnBuilder().build(column);
    if (!param.columnWebhookManager) {
      await columnWebhookManager.populateNewColumns();
      columnWebhookManager.emit();
    }
    return v3Response;
  }

  async columnGet(context: NcContext, param: { columnId: string }) {
    const column = await Column.get(context, { colId: param.columnId });
    if (!column) {
      NcError.get(context).fieldNotFound(param.columnId);
    }
    return columnBuilder().build(column);
  }

  async columnAdd(
    context: NcContext,
    param: {
      req: NcRequest;
      tableId: string;
      column: FieldV3Type;
      user: UserType;
      reuse?: ReusableParams;
      columnWebhookManager?: ColumnWebhookManager;
    },
    ncMeta = Noco.ncMeta,
  ) {
    validatePayload(
      'swagger-v3.json#/components/schemas/CreateField',
      param.column,
      true,
      context,
    );
    validatePayload(
      `swagger-v3.json#/components/schemas/FieldOptions/${param.column.type}`,
      param.column,
      true,
      context,
    );

    const columnWebhookManager =
      param.columnWebhookManager ??
      (
        await new ColumnWebhookManagerBuilder(context, ncMeta).withModelId(
          param.tableId,
        )
      ).forCreate();
    const column = columnV3ToV2Builder().build(
      param.column,
    ) as ColumnReqWithMeta & {
      parentId?: string;
    };

    // if LTAR column then define table id as parent id in request
    // and set version to V2 so all relation types use junction tables
    if (isLinksOrLTAR(column)) {
      if (!column.parentId) {
        column.parentId = param.tableId;
      }
      (column as any).version = LinksVersion.V2;
    }

    if (
      [UITypes.SingleSelect, UITypes.MultiSelect].includes(
        column.uidt as UITypes,
      )
    ) {
      if (column.meta) {
        column.meta.choices = undefined;
      }
      column.dtxp = column.colOptions?.options
        ?.map((o: any) => `${o.value}`)
        .join('');
    }

    const res = await this.columnsService.columnAdd(
      context,
      {
        ...param,
        column,
        apiVersion: NcApiVersion.V3,
        columnWebhookManager: columnWebhookManager,
      },
      ncMeta,
    );

    // do tranformation
    const v3Response = columnBuilder().build(res);
    await columnWebhookManager.addNewColumn({
      column: v3Response,
      action: WebhookActions.INSERT,
    });
    if (!param.columnWebhookManager) {
      columnWebhookManager.emit();
    }
    return v3Response;
  }

  async columnDelete(
    context: NcContext,
    param: {
      req: NcRequest;
      columnId: string;
      forceDeleteSystem?: boolean;
      reuse?: ReusableParams;
      columnWebhookManager?: ColumnWebhookManager;
    },
    ncMeta = Noco.ncMeta,
  ) {
    await this.columnsService.columnDelete(context, param, ncMeta);

    return {};
  }

  // Read the current select choices from the v3 read representation so they
  // carry their stable `id`s — passing those ids back through columnUpdate is
  // what makes the underlying option diff preserve them (no data loss).
  private getSelectColumnChoices(
    context: NcContext,
    columnId: string,
    column: Column,
  ): { current: FieldV3Type; choices: SelectChoiceV3[] } {
    if (![UITypes.SingleSelect, UITypes.MultiSelect].includes(column.uidt)) {
      NcError.get(context).invalidRequestBody(
        'Options can only be managed on SingleSelect or MultiSelect fields.',
      );
    }

    const current = columnBuilder().build(column) as FieldV3Type;
    const choices =
      (current as { options?: { choices?: SelectChoiceV3[] } }).options
        ?.choices ?? [];

    return { current, choices };
  }

  // A choice added without an explicit `color` is persisted with `color: null`.
  // On the NEXT options mutation, that choice is read back and re-fed to
  // `columnUpdate`, whose FieldOptions_Select schema requires `color` to be a
  // string — so the second add/delete would fail with "'color' must be a
  // string". Assign a palette color to any choice missing one (matching how the
  // UI colors new select options) before the choices are persisted, so colors
  // are never null and repeated add/remove stays retry-safe. Existing string
  // colors are preserved.
  private ensureChoiceColors(choices: SelectChoiceV3[]): SelectChoiceV3[] {
    return choices.map((choice, index) => ({
      ...choice,
      color:
        typeof choice.color === 'string' && choice.color
          ? choice.color
          : enumColors.get('light', index),
    }));
  }

  async columnOptionsAdd(
    context: NcContext,
    param: {
      req: NcRequest;
      columnId: string;
      choices: FieldOptionAddItemV3Type[];
      user: UserType;
    },
    ncMeta = Noco.ncMeta,
  ) {
    validatePayload(
      'swagger-v3.json#/components/schemas/FieldOptionsAddReq',
      { choices: param.choices },
      true,
      context,
    );

    const column = await Column.get(context, { colId: param.columnId }, ncMeta);

    if (!column) {
      NcError.get(context).fieldNotFound(param.columnId);
    }

    const { current, choices: existingChoices } = this.getSelectColumnChoices(
      context,
      param.columnId,
      column,
    );

    // Reject duplicate titles *within* the request body. The schema's
    // `uniqueItems` only dedupes identical objects, not same-title-different-color.
    const seenTitles = new Set<string>();
    for (const choice of param.choices) {
      const title = choice.title.trim();
      if (seenTitles.has(title)) {
        NcError.get(context).invalidRequestBody(
          `Duplicate choice title in request: '${title}'`,
        );
      }
      seenTitles.add(title);
    }

    // Idempotent add: skip incoming titles that already exist on the field.
    const existingTitles = new Set(existingChoices.map((c) => c.title));
    const choicesToAdd = param.choices
      .filter((choice) => !existingTitles.has(choice.title.trim()))
      .map((choice) => ({
        title: choice.title.trim(),
        ...(choice.color ? { color: choice.color } : {}),
      }));

    // Every incoming title already exists — idempotent no-op, return as-is
    // (also avoids a needless column rebuild).
    if (choicesToAdd.length === 0) {
      return current;
    }

    const mergedChoices = this.ensureChoiceColors([
      ...existingChoices,
      ...choicesToAdd,
    ]);

    return this.columnUpdate(
      context,
      {
        req: param.req,
        columnId: param.columnId,
        column: {
          type: current.type,
          options: { choices: mergedChoices },
        } as FieldUpdateV3Type,
        user: param.user,
      },
      ncMeta,
    );
  }

  async columnOptionsDelete(
    context: NcContext,
    param: {
      req: NcRequest;
      columnId: string;
      choices: FieldOptionDeleteItemV3Type[];
      user: UserType;
    },
    ncMeta = Noco.ncMeta,
  ) {
    validatePayload(
      'swagger-v3.json#/components/schemas/FieldOptionsDeleteReq',
      { choices: param.choices },
      true,
      context,
    );

    const column = await Column.get(context, { colId: param.columnId }, ncMeta);

    if (!column) {
      NcError.get(context).fieldNotFound(param.columnId);
    }

    const { current, choices: existingChoices } = this.getSelectColumnChoices(
      context,
      param.columnId,
      column,
    );

    // Idempotent delete: ignore titles that aren't present on the field.
    // Titles are matched exactly (no trim / case-folding) — the caller passes
    // back verbatim whatever title the read response returned. If a column
    // somehow holds duplicate titles (the v3 add path forbids them, but the v2
    // API / UI can create them), every choice matching the title is removed.
    const titlesToRemove = new Set(param.choices.map((choice) => choice.title));
    const mergedChoices = this.ensureChoiceColors(
      existingChoices.filter((choice) => !titlesToRemove.has(choice.title)),
    );

    // No title matched an existing choice — idempotent no-op, return as-is.
    if (mergedChoices.length === existingChoices.length) {
      return current;
    }

    if (mergedChoices.length === 0) {
      NcError.get(context).badRequest('At least one option is required.');
    }

    return this.columnUpdate(
      context,
      {
        req: param.req,
        columnId: param.columnId,
        column: {
          type: current.type,
          options: { choices: mergedChoices },
        } as FieldUpdateV3Type,
        user: param.user,
      },
      ncMeta,
    );
  }
}
