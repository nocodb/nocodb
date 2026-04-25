import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  isSmartText,
  SMART_TEXT_MAX_BYTES,
  UITypes,
} from 'nocodb-sdk';
import type { ProseMirrorDoc } from 'nocodb-sdk';
import { SmartTextService as SmartTextServiceCE } from 'src/services/smart-text.service';
import type { SmartTextGetResult } from 'src/services/smart-text.service';
import type { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import {
  markdownToProseMirror,
  prosemirrorToMarkdown,
} from '~/ee/helpers/prosemirrorUtils';
import { prepareMetaUpdateQuery } from '~/ee/helpers/metaColumnHelpers';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import Model from '~/models/Model';
import Source from '~/models/Source';
import Column from '~/models/Column';
import FileReference from '~/models/FileReference';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';

const META_COL_NAME = 'nc_row_meta';

@Injectable()
export class SmartTextService extends SmartTextServiceCE {
  protected logger = new Logger(SmartTextService.name);

  constructor(protected readonly appHooksService: AppHooksService) {
    super();
  }

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

    const row = await dbDriver(tnPath)
      .where(pkColumn.column_name, param.rowId)
      .select(
        column.column_name,
        dbDriver.raw(
          `??->?->>'pm' as nc_smart_pm`,
          [META_COL_NAME, column.id],
        ),
      )
      .first();

    if (!row) {
      NcError.get(context).recordNotFound(param.rowId);
    }

    const markdown: string | null = row[column.column_name] ?? null;
    let pm: ProseMirrorDoc | null = null;

    if (row.nc_smart_pm) {
      try {
        pm =
          typeof row.nc_smart_pm === 'string'
            ? JSON.parse(row.nc_smart_pm)
            : row.nc_smart_pm;
      } catch (e) {
        this.logger.warn(
          `Failed to parse stored PM JSON for ${param.tableId}/${param.rowId}/${param.columnId}: ${e.message}`,
        );
      }
    }

    // Lazy backfill: if PM JSON is missing but markdown exists, convert and persist.
    if (!pm && markdown && markdown.trim().length > 0) {
      try {
        pm = markdownToProseMirror(markdown) as ProseMirrorDoc;
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

    this.appHooksService.emit(AppEvents.DATA_UPDATE, {
      context,
      req: param.req,
      model,
      view: null,
      data: {
        [column.title]: markdown,
        rowId: param.rowId,
      },
      ip: param.req?.clientIp,
    } as any);

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
    if (!source?.is_meta) {
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
    req: NcRequest,
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

    for (const fileNode of fileNodes) {
      if (!fileNode.id && fileNode.path) {
        const newId = await FileReference.insert(context, {
          storage: storageAdapter.name,
          file_url: fileNode.path,
          file_size: fileNode.node.attrs?.fileSize || 0,
          fk_user_id: req.user?.id ?? 'anonymous',
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
