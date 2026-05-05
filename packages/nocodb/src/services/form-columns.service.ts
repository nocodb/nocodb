import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  FORM_ROW_FULL_WIDTH_UI_TYPES,
  FORM_ROW_MAX_FIELDS,
} from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { NcContext } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import {
  type ViewWebhookManager,
  ViewWebhookManagerBuilder,
} from '~/utils/view-webhook-manager';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { OperationName } from '~/command-registry/op-names';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { assertNotLockedViewOnSandboxProduction } from '~/helpers/sandboxGuards';
import { Column, FormViewColumn, View } from '~/models';
import { extractProps } from '~/helpers/extractProps';
import { NcError } from '~/helpers/ncError';
import Noco from '~/Noco';
import { NcBaseError } from '~/helpers/catchError';

// row_id is a client-generated grouping key for form view columns that
// share a horizontal row. Format: `fr_<lowercase alphanumerics>`.
const ROW_ID_PATTERN = /^fr_[a-z0-9]+$/;

@Injectable()
export class FormColumnsService {
  protected logger = new Logger(FormColumnsService.name);

  constructor(protected readonly appHooksService: AppHooksService) {}

  @TraceCommand(OperationName.formColumnUpdate)
  async columnUpdate(
    context: NcContext,
    param: {
      formViewColumnId: string;
      // todo: replace with FormColumnReq
      formViewColumn: FormViewColumn;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    validatePayload(
      'swagger.json#/components/schemas/FormColumnReq',
      param.formViewColumn,
    );
    const oldFormViewColumn = await FormViewColumn.get(
      context,
      param.formViewColumnId,
      ncMeta,
    );

    if (oldFormViewColumn?.fk_view_id) {
      await assertNotLockedViewOnSandboxProduction(
        context,
        oldFormViewColumn.fk_view_id,
      );
    }

    const view = await View.get(
      context,
      oldFormViewColumn.fk_view_id,
      false,
      ncMeta,
    );

    const column = await Column.get(
      context,
      {
        colId: oldFormViewColumn.fk_column_id,
      },
      ncMeta,
    );

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(view.id)
      ).forUpdate();

    const res = await FormViewColumn.update(
      context,
      param.formViewColumnId,
      param.formViewColumn,
      ncMeta,
    );

    this.appHooksService.emit(AppEvents.VIEW_COLUMN_UPDATE, {
      oldViewColumn: oldFormViewColumn,
      viewColumn: extractProps(param.formViewColumn, [
        'label',
        'help',
        'description',
        'required',
        'show',
        'order',
        'row_id',
        'meta',
        'enable_scanner',
      ]),
      view,
      column,
      req: param.req,
      context,
    });

    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }
    return res;
  }

  /**
   * Atomically re-layout multiple form columns in a single request.
   *
   * Used by the grid-layout drag-drop editor where moving one field typically
   * changes `row_id` and/or `order` on several sibling columns at once. Keeps
   * the reflow transactional (all updates committed together or none) and
   * avoids N HTTP round-trips from the client.
   *
   * Guarded here at the CE layer so the op is unreachable on CE builds and
   * unlicensed on-prem — the EE override adds a per-plan `checkForFeature`
   * on top of this.
   */
  async columnBulkUpdate(
    context: NcContext,
    param: {
      formViewId: string;
      updates: Array<{ id: string; row_id?: string | null; order?: number }>;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    _ncMeta?: MetaService,
  ) {
    // Grid layout is an EE feature. CE builds and unlicensed on-prem fall
    // through here (the EE @EEOnly override is skipped when unlicensed).
    if (!Noco.isEE()) {
      NcError.notImplemented('Form grid layout');
    }

    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    if (!Array.isArray(param.updates) || param.updates.length === 0) {
      NcError.get(context).invalidRequestBody(
        'updates must be a non-empty array',
      );
    }

    // Validate each update entry before touching the DB.
    for (const u of param.updates) {
      if (!u.id || typeof u.id !== 'string') {
        NcError.get(context).invalidRequestBody('each update must have an id');
      }
      if (
        u.row_id != null &&
        (typeof u.row_id !== 'string' || !ROW_ID_PATTERN.test(u.row_id))
      ) {
        NcError.get(context).invalidRequestBody(
          `Invalid row_id format: ${u.row_id}`,
        );
      }
      if (u.order !== undefined && typeof u.order !== 'number') {
        NcError.get(context).invalidRequestBody('order must be a number');
      }
    }

    const view = await View.get(context, param.formViewId);
    if (!view) {
      NcError.get(context).viewNotFound(param.formViewId);
    }

    // Validate max fields per row against the final projected state —
    // updates may move fields in/out of rows, so compute counts after apply.
    const existingCols = await FormViewColumn.list(context, param.formViewId);
    const existingById = new Map(existingCols.map((c) => [c.id, c]));

    for (const u of param.updates) {
      if (!existingById.has(u.id)) {
        NcError.get(context).genericNotFound('FormViewColumn', u.id);
      }
    }

    const projected = existingCols.map((c) => {
      const u = param.updates.find((u) => u.id === c.id);
      if (!u) return { id: c.id, row_id: c.row_id ?? null };
      return {
        id: c.id,
        row_id: u.row_id === undefined ? c.row_id ?? null : u.row_id ?? null,
      };
    });

    const rowCounts = new Map<string, number>();
    for (const p of projected) {
      if (!p.row_id) continue;
      rowCounts.set(p.row_id, (rowCounts.get(p.row_id) ?? 0) + 1);
    }
    for (const [rowId, count] of rowCounts) {
      if (count > FORM_ROW_MAX_FIELDS) {
        NcError.get(context).invalidRequestBody(
          `Row ${rowId} would contain ${count} fields; maximum is ${FORM_ROW_MAX_FIELDS}`,
        );
      }
    }

    // Reject row_id on columns whose underlying uidt is full-width.
    // The frontend's onFieldMoveCallback rejects this drop, but a
    // hand-crafted POST could still set row_id on a LongText etc.;
    // groupFormColumnsByRow would then split that row visually so the
    // row_id is dead data. Validate at the API boundary instead.
    const fullWidthSet = new Set(FORM_ROW_FULL_WIDTH_UI_TYPES as string[]);
    const targetingFullWidth = param.updates.filter((u) => {
      if (!u.row_id) return false;
      const fvc = existingById.get(u.id);
      return !!fvc?.fk_column_id;
    });
    if (targetingFullWidth.length) {
      const colCache = new Map<string, Column>();
      for (const u of targetingFullWidth) {
        const fvc = existingById.get(u.id)!;
        const colId = fvc.fk_column_id!;
        if (!colCache.has(colId)) {
          colCache.set(colId, await Column.get(context, { colId }));
        }
        const col = colCache.get(colId)!;
        if (col?.uidt && fullWidthSet.has(col.uidt)) {
          NcError.get(context).invalidRequestBody(
            `Field type '${col.uidt}' must occupy its own row; row_id cannot be set`,
          );
        }
      }
    }

    // Wrap all writes in a transaction so a partial failure can't leave the
    // form view with mismatched row_ids / orders.
    const ncMeta = await Noco.ncMeta.startTransaction();

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(view.id)
      ).forUpdate();

    try {
      // Cache Column lookups so the audit payload per form-column update
      // doesn't re-hit the DB for each sibling in a drag reflow.
      const columnCache = new Map<string, Column>();
      const getUnderlyingColumn = async (colId: string) => {
        if (!columnCache.has(colId)) {
          columnCache.set(colId, await Column.get(context, { colId }, ncMeta));
        }
        return columnCache.get(colId)!;
      };

      const auditQueue: Array<{
        oldFormViewColumn: FormViewColumn;
        body: { row_id?: string | null; order?: number };
      }> = [];

      for (const u of param.updates) {
        const body = extractProps(u, ['row_id', 'order']);
        const oldFormViewColumn = existingById.get(u.id)!;

        const rowIdChanged =
          body.row_id !== undefined &&
          (oldFormViewColumn.row_id ?? null) !== (body.row_id ?? null);
        const orderChanged =
          body.order !== undefined && oldFormViewColumn.order !== body.order;

        await FormViewColumn.update(context, u.id, body, ncMeta);

        if (rowIdChanged || orderChanged) {
          auditQueue.push({ oldFormViewColumn, body });
        }
      }

      await ncMeta.commit();

      // Emit audit events only after the transaction succeeds — otherwise
      // a rollback would leave audit entries for changes that didn't stick.
      for (const entry of auditQueue) {
        const column = await getUnderlyingColumn(
          entry.oldFormViewColumn.fk_column_id,
        );
        this.appHooksService.emit(AppEvents.VIEW_COLUMN_UPDATE, {
          oldViewColumn: entry.oldFormViewColumn,
          viewColumn: extractProps(entry.body, ['row_id', 'order']),
          view,
          column,
          req: param.req,
          context,
        });
      }

      if (!param.viewWebhookManager) {
        (await viewWebhookManager.withNewViewId(view.id)).emit();
      }

      return { msg: 'Form columns updated' };
    } catch (e) {
      await ncMeta.rollback();
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      this.logger.error('Error bulk updating form columns', e?.stack);
      NcError.get(context).badRequest('Failed to update form columns');
    }
  }
}
