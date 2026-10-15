import { Injectable, Logger } from '@nestjs/common';
import {
  enumColors,
  isLinksOrLTAR,
  LinksVersion,
  NcApiVersion,
  parseProp,
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
import { DataTableService } from '~/services/data-table.service';
import { Column, Model } from '~/models';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
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

// Types whose cells are computed or linked, so a before/after count of
// non-empty cells says nothing about data loss.
const NO_CELL_VALUES = new Set<string>([
  UITypes.Lookup,
  UITypes.Rollup,
  UITypes.Formula,
  UITypes.Button,
  UITypes.QrCode,
  UITypes.Barcode,
]);

function holdsCells(uidt: string): boolean {
  return !isLinksOrLTAR(uidt) && !NO_CELL_VALUES.has(uidt);
}

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

/**
 * A choice sent without an `id` takes the id and colour of the stored choice
 * with its title, so a rewrite keeps the cell values and colours it leaves alone.
 */
export function carrySelectChoiceIdentity(
  incoming: SelectChoiceV3[],
  stored: SelectChoiceV3[],
): SelectChoiceV3[] {
  // An id sent explicitly is not also handed to a title match.
  const claimed = new Set(incoming.map((c) => c.id).filter(Boolean));
  return incoming.map((choice, index) => {
    const match =
      (choice.id && stored.find((s) => s.id === choice.id)) ||
      stored.find((s) => s.title === choice.title && !claimed.has(s.id));

    return {
      ...(match?.id ? { id: match.id } : {}),
      title: choice.title,
      color: choice.color || match?.color || enumColors.get('light', index),
    };
  });
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
  protected readonly logger = new Logger(ColumnsV3Service.name);

  constructor(
    protected readonly columnsService: ColumnsService,
    protected readonly dataTableService: DataTableService,
  ) {}

  /**
   * columnUpdate, plus what it destroyed: cells cleared by a type conversion
   * or a removed choice, and, when a link is converted away, its new field id
   * and the lookups/rollups left broken. Counted before the write, since the
   * rows no longer show what was lost afterwards.
   */
  async columnUpdateWithReport(
    context: NcContext,
    param: {
      req: any;
      columnId: string;
      column: FieldUpdateV3Type;
      user: UserType;
    },
  ) {
    const before = await Column.get(context, { colId: param.columnId });
    const newType = (param.column as { type?: string }).type;
    const typeChanges = !!before && !!newType && newType !== before.uidt;
    const fromLink = typeChanges && isLinksOrLTAR(before);

    const dependents = fromLink
      ? await this.linkDependents(context, param.columnId)
      : [];
    const choiceCounts = await this.countRemovedChoices(
      context,
      before,
      typeChanges
        ? undefined
        : (param.column as FieldOptionsRecord).options?.choices,
    );
    // System and pk fields can't change type; leave the rejection to columnUpdate.
    const nonEmptyBefore =
      typeChanges && holdsCells(before.uidt) && !before.system && !before.pk
        ? await this.countCells(context, before.fk_model_id, param.columnId)
        : undefined;

    const updated = (await this.columnUpdate(context, param)) as FieldV3Type;

    const warnings: string[] = [];
    let conversion: Record<string, number> | undefined;

    if (nonEmptyBefore !== undefined && holdsCells(updated.type)) {
      // The field is already converted, so a failed count must not fail the request.
      let nonEmptyAfter: number | undefined;
      try {
        nonEmptyAfter = await this.countCells(
          context,
          before.fk_model_id,
          updated.id,
        );
      } catch (e) {
        this.logger.error(
          `Counting cells after converting field ${updated.id} failed: ${e?.message}`,
          e?.stack,
        );
        warnings.push(
          'The field was converted, but the cells left empty by the conversion could not be counted.',
        );
      }
      if (nonEmptyAfter !== undefined) {
        const cleared = Math.max(0, nonEmptyBefore - nonEmptyAfter);
        conversion = {
          non_empty_before: nonEmptyBefore,
          non_empty_after: nonEmptyAfter,
          cleared_rows: cleared,
        };
        if (cleared) {
          warnings.push(
            `${cleared} cell value(s) became empty in this conversion and cannot be recovered. ` +
              'Values that were rounded or reformatted are not counted.',
          );
        }
      }
    }

    if (fromLink) {
      if (updated.id !== param.columnId) {
        warnings.push(
          `The link was replaced by a new field with id ${updated.id}. ` +
            `Field ${param.columnId} no longer exists.`,
        );
      }
      if (dependents.length) {
        warnings.push(
          `${dependents.length} lookup/rollup field(s) read through the removed link and now show errors: ` +
            dependents.map((d) => `${d.title} (${d.id})`).join(', ') +
            '. Delete or repoint them.',
        );
      }
    }

    const clearedRows = choiceCounts.cleared + (conversion?.cleared_rows ?? 0);

    return {
      ...updated,
      ...(clearedRows
        ? {
            cleared_rows: clearedRows,
            ...(choiceCounts.cleared
              ? { cleared_by_choice: choiceCounts.byChoice }
              : {}),
          }
        : {}),
      ...(conversion ? { conversion } : {}),
      ...(dependents.length ? { dependents } : {}),
      ...(warnings.length ? { warnings } : {}),
    };
  }

  // A filter object, not the `where` grammar: a choice title such as
  // "Done (archived)" does not parse there.
  private async countWhere(
    context: NcContext,
    modelId: string,
    filter: { fk_column_id: string; comparison_op: string; value?: string },
  ): Promise<number> {
    const { count } = await this.dataTableService.dataCount(context, {
      modelId,
      query: { filterArrJson: JSON.stringify([filter]) },
    });
    return Number(count) || 0;
  }

  private countCells(context: NcContext, modelId: string, columnId: string) {
    return this.countWhere(context, modelId, {
      fk_column_id: columnId,
      comparison_op: 'notblank',
    });
  }

  /**
   * Cells a select rewrite will clear: a stored choice that no incoming choice
   * keeps (by id, or by title when the id is omitted) is nulled out of its rows.
   */
  private async countRemovedChoices(
    context: NcContext,
    column: Column | undefined,
    incoming: unknown,
  ): Promise<{ cleared: number; byChoice: Record<string, number> }> {
    const byChoice: Record<string, number> = {};
    if (
      !column ||
      !Array.isArray(incoming) ||
      ![UITypes.SingleSelect, UITypes.MultiSelect].includes(
        column.uidt as UITypes,
      )
    ) {
      return { cleared: 0, byChoice };
    }

    const kept = new Set(
      carrySelectChoiceIdentity(
        incoming as SelectChoiceV3[],
        this.storedChoices(column),
      ).map((choice) => choice.id),
    );
    // MultiSelect stores a comma-joined list, so `eq` would only match one choice.
    const operator = column.uidt === UITypes.MultiSelect ? 'anyof' : 'eq';

    for (const choice of this.storedChoices(column).filter(
      (c) => !kept.has(c.id),
    )) {
      const count = await this.countWhere(context, column.fk_model_id, {
        fk_column_id: column.id,
        comparison_op: operator,
        value: choice.title,
      });
      if (count) byChoice[choice.title] = count;
    }

    return {
      cleared: Object.values(byChoice).reduce((sum, n) => sum + n, 0),
      byChoice,
    };
  }

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

    const isTypeChange =
      !!param.column.type && param.column.type !== column.uidt;

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

      if (incomingOptions && !isTypeChange) {
        const merged = this.mergeStoredOptions(
          optionsSchema.schema,
          incomingOptions,
          column,
        );
        if (
          [UITypes.SingleSelect, UITypes.MultiSelect].includes(
            optionsType as UITypes,
          ) &&
          Array.isArray(merged.choices)
        ) {
          merged.choices = carrySelectChoiceIdentity(
            merged.choices as SelectChoiceV3[],
            this.storedChoices(column),
          );
        }
        (param.column as FieldOptionsRecord).options = merged;
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

      // Without `options` the builder emits an empty `meta`, which replaces the
      // stored one and drops Currency code, Rating max, date format, etc.
      if (!(param.column as FieldOptionsRecord).options && !isTypeChange) {
        processedColumnReq.meta = parseProp(column.meta);
      }
    }

    // in payload id is required in existing implementation
    const { title: previousTitle, fk_model_id: tableId } = column;
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

    // Link → text replaces the link with a new column and id. Follow it by
    // title, since the old id no longer resolves.
    if (!column) {
      const replacement = (
        await Column.list(context, { fk_model_id: tableId })
      ).find(
        (c) => c.title === previousTitle && c.uidt === UITypes.SingleLineText,
      );
      if (!replacement) NcError.get(context).fieldNotFound(param.columnId);
      column = replacement;
      columnWebhookManager.followReplacedColumn(param.columnId, column.id);
    }

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

  storedChoices(column: Column): SelectChoiceV3[] {
    const current = columnBuilder().build(column) as {
      options?: { choices?: SelectChoiceV3[] };
    };
    return current.options?.choices ?? [];
  }

  /** Lookups and rollups that read through a link column. */
  async linkDependents(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<{ id: string; title: string; table_id: string; uidt: string }[]> {
    const rows = [
      ...(await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_LOOKUP,
        { condition: { fk_relation_column_id: columnId } },
      )),
      ...(await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_ROLLUP,
        { condition: { fk_relation_column_id: columnId } },
      )),
    ];

    const dependents: {
      id: string;
      title: string;
      table_id: string;
      uidt: string;
    }[] = [];
    for (const row of rows) {
      const col = await Column.get(
        context,
        { colId: row.fk_column_id },
        ncMeta,
      );
      if (col) {
        dependents.push({
          id: col.id,
          title: col.title,
          table_id: col.fk_model_id,
          uidt: col.uidt,
        });
      }
    }
    return dependents;
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
