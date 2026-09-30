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
import { Column, Model } from '~/models';
import Noco from '~/Noco';
import {
  columnBuilder,
  columnV3ToV2Builder,
} from '~/utils/api-v3-data-transformation.builder';
import { validatePayload } from '~/helpers';
import { resolveFieldOptionsSchema } from '~/helpers/fieldOptionsSchema';

type ColumnReqWithMeta = ColumnReqType & {
  meta?: any;
  colOptions?: any;
  dtxp?: string;
};

type SelectChoiceV3 = { id?: string; title: string; color?: string };

// `FieldV3Type`/`FieldUpdateV3Type` are discriminated unions, so `options` is
// not uniformly indexable — this is the shape both collapse to here.
type FieldOptionsRecord = { options?: Record<string, unknown> };

const META_ONLY_PROPS = new Set(['description']);

// Button is the one options schema that is a `oneOf`: its properties and its
// `required` list live per action branch, keyed by `options.type`. Reading only
// the top level finds neither, leaving every partial Button update to fail the
// branch's own `required` plus `additionalProperties: false`.
function optionsBranchFor(schema: any, optionsType: unknown): any {
  if (!Array.isArray(schema?.oneOf)) return schema;

  return schema.oneOf.find((branch) =>
    branch?.properties?.type?.enum?.includes(optionsType),
  );
}

// The v3 read builder emits a webhook button's hook as `webhook_id`; older
// callers (and the pre-deprecation schema) send `button_hook_id`. The v3->v2
// write builder already maps both to `fk_webhook_id`, so only validation needs
// to be taught that they are one key — otherwise the object `GET` just returned
// is rejected by the `PATCH` that takes it back.
function withCanonicalOptionAliases<T>(payload: T): T {
  const options = (payload as FieldOptionsRecord).options;

  if (!options || options.button_hook_id === undefined) return payload;

  const { button_hook_id, ...rest } = options;

  return { ...payload, options: { webhook_id: button_hook_id, ...rest } };
}

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

    let column = await Column.get(context, { colId: param.columnId }, ncMeta);

    if (!column) {
      NcError.get(context).fieldNotFound(param.columnId);
    }

    // Validate `options` against the field type. `type` is optional on update
    // (a rename must not require re-sending it), so fall back to the stored
    // type — otherwise an options-only update skips validation entirely and
    // unsupported keys (min/max/max_length/pattern) get silently persisted
    // into column meta where they read back as though enforced.
    const optionsType = (param.column.type ?? column.uidt) as string;
    const optionsSchema = optionsType
      ? resolveFieldOptionsSchema(optionsType)
      : null;

    if (optionsSchema) {
      param.column = withCanonicalOptionAliases(param.column);

      // A partial options update ("only the keys to change") must merge onto
      // the stored options, not replace them. Without this, an options-only
      // PATCH like `{ options: { rollup_function: 'sum' } }` fails the schema's
      // `required` members (Lookup/Rollup/Links/LTAR and every Button branch
      // declare them) and, even when it validates, wipes every option the
      // caller didn't resend. Skipped on a type change — the stored options
      // belong to the old type.
      const incomingOptions = (param.column as FieldOptionsRecord).options;
      const isTypeChange =
        !!param.column.type && param.column.type !== column.uidt;

      if (incomingOptions && !isTypeChange) {
        (param.column as FieldOptionsRecord).options = this.mergeStoredOptions(
          optionsSchema.schema,
          incomingOptions,
          column,
        );
      }

      validatePayload(optionsSchema.ref, param.column, true, context);
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

    // Check if this is a meta-only update (description, meta) — if so,
    // skip v3-to-v2 transformation to avoid injecting title/column_name
    // which would make the payload appear structural
    const isMetaOnlyUpdate = Object.keys(param.column).every((k) =>
      META_ONLY_PROPS.has(k),
    );

    let processedColumnReq: ColumnReqWithMeta;

    if (isMetaOnlyUpdate) {
      processedColumnReq = { ...param.column } as ColumnReqWithMeta;
    } else {
      const type = (param.column?.type ?? column.uidt) as FieldV3Type['type'];

      processedColumnReq = columnV3ToV2Builder().build({
        ...param.column,
        type,
      } as FieldV3Type) as ColumnReqWithMeta;

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
        column.dtxp = (
          column.colOptions as unknown as { options: any[] }
        )?.options
          ?.map((o: any) => `'${o.value}'`)
          .join('');
      }
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

  // Merge the stored options under an incoming partial `options` so callers can
  // send only the keys they want to change. Only keys the type's options schema
  // declares are carried over — the v3 read emits extra keys (e.g. an LTAR's
  // read-only `related_field_id`, or `custom`) that `additionalProperties:
  // false` would reject on echo. Types whose schema models no named properties
  // are left untouched.
  private mergeStoredOptions(
    optionsSchema: any,
    incomingOptions: Record<string, unknown>,
    stored: Column,
  ): Record<string, unknown> {
    const storedOptions =
      (columnBuilder().build(stored) as FieldOptionsRecord).options ?? {};

    // Which branch a Button update targets is decided by the action type it
    // carries, falling back to the stored one for an options-only update.
    const branch = optionsBranchFor(
      optionsSchema,
      incomingOptions.type ?? storedOptions.type,
    );

    const allowedKeys = branch?.properties
      ? Object.keys(branch.properties)
      : null;

    if (!allowedKeys) return incomingOptions;

    const merged: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      if (key in storedOptions) merged[key] = storedOptions[key];
    }
    Object.assign(merged, incomingOptions);

    return merged;
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
      withCanonicalOptionAliases(param.column),
      true,
      context,
    );

    // Guard the target table before it is dereferenced downstream — an unknown
    // id otherwise surfaces as a raw `Cannot read properties of undefined
    // (reading 'base_id')` from the webhook-manager builder.
    if (!(await Model.get(context, param.tableId, false, ncMeta))) {
      NcError.get(context).tableNotFound(param.tableId);
    }

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
