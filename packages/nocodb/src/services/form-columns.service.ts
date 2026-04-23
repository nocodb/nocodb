import { Injectable } from '@nestjs/common';
import { AppEvents, FORM_ROW_MAX_FIELDS } from 'nocodb-sdk';
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

@Injectable()
export class FormColumnsService {
  constructor(private readonly appHooksService: AppHooksService) {}

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
   * the reflow transactional from the client's perspective and avoids N HTTP
   * round-trips.
   */
  async columnBulkUpdate(
    context: NcContext,
    param: {
      formViewId: string;
      updates: Array<{ id: string; row_id?: string | null; order?: number }>;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    if (!Array.isArray(param.updates) || param.updates.length === 0) {
      NcError.get(context).invalidRequestBody('updates must be a non-empty array');
    }

    const view = await View.get(context, param.formViewId, ncMeta);
    if (!view) {
      NcError.get(context).viewNotFound(param.formViewId);
    }

    // Validate max fields per row against the final projected state —
    // updates may move fields in/out of rows, so compute counts after apply.
    const existingCols = await FormViewColumn.list(
      context,
      param.formViewId,
      ncMeta,
    );
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

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(view.id)
      ).forUpdate();

    // Cache Column lookups so the audit payload per form-column update
    // doesn't re-hit the DB for each sibling in a drag reflow.
    const columnCache = new Map<string, Column>();
    const getUnderlyingColumn = async (colId: string) => {
      if (!columnCache.has(colId)) {
        columnCache.set(
          colId,
          await Column.get(context, { colId }, ncMeta),
        );
      }
      return columnCache.get(colId)!;
    };

    for (const u of param.updates) {
      const body = extractProps(u, ['row_id', 'order']);
      const oldFormViewColumn = existingById.get(u.id)!;

      // Skip audit emit if the update is a no-op (same row_id + same order).
      const rowIdChanged =
        body.row_id !== undefined &&
        (oldFormViewColumn.row_id ?? null) !== (body.row_id ?? null);
      const orderChanged =
        body.order !== undefined && oldFormViewColumn.order !== body.order;

      await FormViewColumn.update(context, u.id, body, ncMeta);

      if (!rowIdChanged && !orderChanged) continue;

      const column = await getUnderlyingColumn(oldFormViewColumn.fk_column_id);

      // Match single-column columnUpdate emit shape so the audit listener
      // produces identical VIEW_COLUMN_UPDATE entries for grid reflows.
      this.appHooksService.emit(AppEvents.VIEW_COLUMN_UPDATE, {
        oldViewColumn: oldFormViewColumn,
        viewColumn: extractProps(body, ['row_id', 'order']),
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
  }
}
