import { Injectable, Logger } from '@nestjs/common';
import { isSmartText, SMART_TEXT_MAX_BYTES, UITypes } from 'nocodb-sdk';
import { SmartTextService as SmartTextServiceCE } from 'src/services/smart-text.service';
import type { ProseMirrorDoc } from 'nocodb-sdk';
import type { SmartTextGetResult } from 'src/services/smart-text.service';
import type { NcContext, NcRequest } from '~/interface/config';
import type Column from '~/models/Column';
import { NcError } from '~/helpers/catchError';
import {
  markdownToProseMirror,
  prosemirrorToMarkdown,
} from '~/ee/helpers/prosemirrorUtils';
import { prepareMetaUpdateQuery } from '~/ee/helpers/metaColumnHelpers';
import Model from '~/models/Model';
import Source from '~/models/Source';
import FileReference from '~/models/FileReference';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';

const META_COL_NAME = 'nc_row_meta';

@Injectable()
export class SmartTextService extends SmartTextServiceCE {
  protected logger = new Logger(SmartTextService.name);

  async getContent(
    context: NcContext,
    param: { tableId: string; rowId: string; columnId: string },
  ): Promise<SmartTextGetResult> {
    const { model, column, source } = await this._loadAndValidate(
      context,
      param.tableId,
      param.columnId,
    );

    const dbDriver = await NcConnectionMgrv2.get(source);
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      dbDriver,
      source,
    });

    const tnPath = baseModel.getTnPath(model.table_name);
    const pkColumn = model.primaryKey;
    if (!pkColumn) {
      NcError.get(context).badRequest(
        'SmartText cells require a primary key on the table',
      );
    }

    // Read the markdown cell value AND the PM JSON extract in a single query so
    // both reflect the same row snapshot. Two separate reads are racy: a
    // concurrent updateContent (atomic UPDATE of both cell + nc_row_meta) can
    // land between the markdown and PM reads, leaving us with empty markdown
    // + non-empty PM. The cleanup branch below would then wipe the freshly
    // written PM, causing data loss (image refs, custom attrs lost — only the
    // markdown→PM regeneration survives).
    //
    // Skipping baseModel.readByPk here forfeits its AST / aliasing / RLS
    // wrapping, but for a SmartText cell this is acceptable: the panel is
    // always opened from a row already visible in the grid (RLS already
    // enforced on the parent list read), and ACL is enforced at the operation
    // level via smartTextGetContent.
    const row = (await dbDriver(tnPath)
      .where(pkColumn.column_name, param.rowId)
      .select(
        column.column_name,
        dbDriver.raw(`??->?->>'pm' as nc_smart_pm`, [META_COL_NAME, column.id]),
      )
      .first()) as
      | { [key: string]: any; nc_smart_pm?: string | object }
      | undefined;
    if (!row) {
      NcError.get(context).recordNotFound(param.rowId);
    }

    const markdownRaw = row[column.column_name];
    const markdown: string | null =
      typeof markdownRaw === 'string' ? markdownRaw : null;

    const pmRow = row;

    let pm: ProseMirrorDoc | null = null;

    /**
     * A PM doc that's structurally empty (no content, or a single empty
     * paragraph). The backend caches such a doc when a cell is cleared via
     * grid; treating it as "no pm" lets the lazy backfill rehydrate the
     * editor when the cell is later repopulated (e.g. paste).
     */
    const isPmEmpty = (doc: any): boolean => {
      if (!doc || doc.type !== 'doc') return true;
      const content = Array.isArray(doc.content) ? doc.content : [];
      if (content.length === 0) return true;
      if (content.length === 1) {
        const only = content[0];
        if (
          only?.type === 'paragraph' &&
          (!Array.isArray(only.content) || only.content.length === 0)
        ) {
          return true;
        }
      }
      return false;
    };

    if (pmRow?.nc_smart_pm) {
      try {
        pm =
          typeof pmRow.nc_smart_pm === 'string'
            ? JSON.parse(pmRow.nc_smart_pm)
            : (pmRow.nc_smart_pm as ProseMirrorDoc);
        if (isPmEmpty(pm)) pm = null;
      } catch (e) {
        this.logger.warn(
          `Failed to parse stored PM JSON for ${param.tableId}/${param.rowId}/${param.columnId}: ${e.message}`,
        );
      }
    }

    const isMarkdownEmpty = !markdown || !markdown.trim();

    // Markdown is authoritative — the grid / data API can clear or rewrite a
    // SmartText cell without going through the panel, leaving the cached pm
    // in nc_row_meta out of sync. If the markdown is empty, discard any stale
    // pm and clean up FileReferences so the panel reflects the cleared state.
    if (isMarkdownEmpty && pm) {
      try {
        const emptyPm: ProseMirrorDoc = {
          type: 'doc',
          content: [{ type: 'paragraph' }],
        } as ProseMirrorDoc;
        await this._reconcileFileReferences(
          context,
          model.id,
          column.id,
          param.rowId,
          emptyPm,
          /* req */ null,
        );
        await this._writeRowMetaPm(
          dbDriver,
          tnPath,
          pkColumn.column_name,
          param.rowId,
          column,
          emptyPm,
          /* userId */ null,
        );
        pm = null;
      } catch (e) {
        this.logger.warn(
          `Stale PM cleanup failed for ${param.tableId}/${param.rowId}/${param.columnId}: ${e.message}`,
          (e as Error)?.stack,
        );
      }
    }

    // Stale PM: when markdown was rewritten via grid (e.g. cell-to-cell paste
    // or data API update), the cached PM in nc_row_meta still reflects the
    // previous content. Markdown is authoritative — discard the stale PM so
    // the lazy backfill below regenerates it from the current markdown.
    // Compare the PM's serialized markdown against the cell's markdown; a
    // mismatch means they diverged.
    if (!isMarkdownEmpty && pm) {
      try {
        const pmMarkdown = prosemirrorToMarkdown(pm).trim();
        if (pmMarkdown !== (markdown as string).trim()) {
          pm = null;
        }
      } catch (e) {
        this.logger.warn(
          `PM↔markdown sync check failed for ${param.tableId}/${param.rowId}/${param.columnId}: ${e.message}`,
        );
        pm = null;
      }
    }

    // Lazy backfill: if PM JSON is missing but markdown exists, convert and
    // persist. Run FileReference reconciliation too — markdown pasted from
    // another cell still references storage paths that need a fresh
    // (model, column, row)-keyed FileReference for the cell-keyed proxy to
    // serve them.
    if (!pm && !isMarkdownEmpty) {
      try {
        pm = markdownToProseMirror(markdown) as ProseMirrorDoc;
        await this._reconcileFileReferences(
          context,
          model.id,
          column.id,
          param.rowId,
          pm,
          /* req */ null,
        );
        await this._writeRowMetaPm(
          dbDriver,
          tnPath,
          pkColumn.column_name,
          param.rowId,
          column,
          pm,
          /* userId */ null,
        );
      } catch (e) {
        this.logger.warn(
          `Lazy MD→PM backfill failed for ${param.tableId}/${param.rowId}/${param.columnId}: ${e.message}`,
          (e as Error)?.stack,
        );
      }
    }

    return { pm, markdown };
  }

  async updateContent(
    context: NcContext,
    param: {
      tableId: string;
      rowId: string;
      columnId: string;
      pmContent: ProseMirrorDoc;
      req: NcRequest;
    },
  ): Promise<SmartTextGetResult> {
    const { model, column, source } = await this._loadAndValidate(
      context,
      param.tableId,
      param.columnId,
    );

    if (
      !param.pmContent ||
      param.pmContent.type !== 'doc' ||
      !Array.isArray(param.pmContent.content)
    ) {
      NcError.get(context).invalidRequestBody(
        'SmartText content must be a ProseMirror doc node',
      );
    }

    const serialized = JSON.stringify(param.pmContent);
    const byteSize = Buffer.byteLength(serialized, 'utf8');
    if (byteSize > SMART_TEXT_MAX_BYTES) {
      NcError.get(context).invalidRequestBody(
        `SmartText content exceeds ${SMART_TEXT_MAX_BYTES} bytes (got ${byteSize})`,
      );
    }

    // Reconcile FileReferences BEFORE deriving markdown so injected IDs
    // are reflected in both the PM JSON and (transitively) the markdown.
    await this._reconcileFileReferences(
      context,
      model.id,
      column.id,
      param.rowId,
      param.pmContent,
      param.req,
    );

    const markdown = prosemirrorToMarkdown(param.pmContent);

    const dbDriver = await NcConnectionMgrv2.get(source);
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      dbDriver,
      source,
    });
    const tnPath = baseModel.getTnPath(model.table_name);
    const pkColumn = model.primaryKey;
    if (!pkColumn) {
      NcError.get(context).badRequest(
        'SmartText cells require a primary key on the table',
      );
    }

    await this._writeRowMetaPm(
      dbDriver,
      tnPath,
      pkColumn.column_name,
      param.rowId,
      column,
      param.pmContent,
      param.req.user?.id ?? null,
      markdown,
    );

    // TODO: emit DATA_UPDATE app event for audit. Data-plane cell updates use
    // Noco.eventEmitter directly (see BaseModelSqlv2 RECORDS_SOFT_DELETE) rather
    // than the typed appHooksService.emit; wire SmartText into the same path
    // when the audit listener is updated to recognize SmartText writes.

    return { pm: param.pmContent, markdown };
  }

  // ---------------------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------------------

  protected async _loadAndValidate(
    context: NcContext,
    tableId: string,
    columnId: string,
  ): Promise<{ model: Model; column: Column; source: Source }> {
    const model = await Model.get(context, tableId);
    if (!model) {
      NcError.get(context).tableNotFound(tableId);
    }

    await model.getColumns(context);
    const column = model.columns.find((c) => c.id === columnId);
    if (!column) {
      NcError.get(context).fieldNotFound(columnId);
    }

    if (!isSmartText(column)) {
      NcError.get(context).invalidRequestBody(
        `Column ${columnId} is not a SmartText field`,
      );
    }

    const metaColumn = model.columns.find((c) => c.uidt === UITypes.Meta);
    if (!metaColumn) {
      NcError.get(context).badRequest(
        'SmartText requires nc_row_meta on the table — not available on this source',
      );
    }

    const source = await Source.get(context, model.source_id);
    if (!source?.isMeta()) {
      NcError.get(context).invalidRequestBody(
        'SmartText is only supported on internal sources',
      );
    }

    return { model, column, source };
  }

  /**
   * Atomic write: cell column ← markdown (when provided) and
   * nc_row_meta JSONB merge ← { [colId]: { pm, modifiedTime, modifiedBy } }.
   */
  protected async _writeRowMetaPm(
    dbDriver: any,
    tnPath: string,
    pkColumnName: string,
    rowId: string,
    column: Column,
    pmContent: ProseMirrorDoc,
    userId: string | null,
    markdown?: string,
  ) {
    const updateObj: Record<string, any> = {};

    if (markdown !== undefined) {
      updateObj[column.column_name] = markdown;
    }

    updateObj[META_COL_NAME] = prepareMetaUpdateQuery({
      knex: dbDriver,
      colIds: [column.id],
      props: {
        pm: pmContent,
        modifiedTime: new Date().toISOString(),
        modifiedBy: userId,
      },
      metaColumn: { uidt: UITypes.Meta, column_name: META_COL_NAME } as any,
    });

    await dbDriver(tnPath).where(pkColumnName, rowId).update(updateObj);
  }

  /**
   * Walk PM JSON for image / fileAttachment nodes. Create FileReferences for
   * new files (path but no id) and inject the new IDs back into the content.
   * Soft-delete previously-tracked refs that no longer appear.
   *
   * Mirrors DocumentsService.reconcileFileReferences but keys off
   * (model_id, column_id, row_id) instead of doc_id.
   */
  protected async _reconcileFileReferences(
    context: NcContext,
    modelId: string,
    columnId: string,
    rowId: string,
    content: ProseMirrorDoc,
    req: NcRequest | null,
  ) {
    const fileNodes: { node: any; id?: string; path?: string }[] = [];
    const walk = (node: any) => {
      if (
        node &&
        (node.type === 'image' || node.type === 'fileAttachment') &&
        node.attrs?.path
      ) {
        fileNodes.push({
          node,
          id: node.attrs.id || undefined,
          path: node.attrs.path,
        });
      }
      if (Array.isArray(node?.content)) {
        for (const child of node.content) walk(child);
      }
    };
    walk(content);

    const storageAdapter = await NcPluginMgrv2.storageAdapter();
    const fkUserId = req?.user?.id ?? 'anonymous';

    // Validate ownership of pre-existing ids — when a cell is duplicated (copy-
    // paste or programmatic write), pasted PM nodes may carry an `id` from the
    // source cell. Treat those as new attachments and fork a fresh
    // FileReference for the destination cell so the cell-keyed proxy resolves.
    for (const fileNode of fileNodes) {
      if (fileNode.id) {
        const existing = await FileReference.get(context, fileNode.id);
        if (
          !existing ||
          existing.deleted ||
          existing.fk_model_id !== modelId ||
          existing.fk_column_id !== columnId ||
          existing.fk_row_id !== rowId
        ) {
          fileNode.id = undefined;
          fileNode.node.attrs.id = null;
        }
      }
    }

    for (const fileNode of fileNodes) {
      if (!fileNode.id && fileNode.path) {
        const newId = await FileReference.insert(context, {
          storage: storageAdapter.name,
          file_url: fileNode.path,
          file_size: fileNode.node.attrs?.fileSize || 0,
          fk_user_id: fkUserId,
          fk_model_id: modelId,
          fk_column_id: columnId,
          fk_row_id: rowId,
        } as any);
        fileNode.node.attrs.id = newId;
        fileNode.id = newId;
      }
    }

    const newIds = new Set(fileNodes.map((n) => n.id).filter(Boolean));
    const existingIds = await FileReference.listIdsForCell(
      context,
      modelId,
      columnId,
      rowId,
    );

    const removedIds = existingIds.filter((id) => !newIds.has(id));
    if (removedIds.length) {
      await FileReference.delete(context, removedIds);
    }
  }
}
