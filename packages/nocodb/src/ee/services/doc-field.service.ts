import { Injectable, Logger } from '@nestjs/common';
import { DocFieldService as DocFieldServiceCE } from 'src/services/doc-field.service';
import type { DocumentType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { Document, FileReference } from '~/models';
import Column from '~/models/Column';

/**
 * Service for Doc field type — manages documents linked to table cells.
 *
 * Each Doc field cell lazily creates a document in nc_docs_v2 with
 * doc_source='field', fk_column_id, and fk_row_id set.
 */
@Injectable()
export class DocFieldService extends DocFieldServiceCE {
  protected logger = new Logger(DocFieldService.name);

  /**
   * Get the document for a specific field + row.
   * Returns null if no document has been created yet.
   */
  async get(
    context: NcContext,
    columnId: string,
    rowId: string,
  ): Promise<DocumentType | null> {
    return Document.getByFieldAndRow(context, columnId, rowId);
  }

  /**
   * Get or lazily create a document for a field + row.
   * Called when the user opens the doc panel for the first time on a cell.
   */
  async getOrCreate(
    context: NcContext,
    columnId: string,
    rowId: string,
    req: NcRequest,
  ): Promise<DocumentType> {
    // Check if doc already exists
    const existing = await Document.getByFieldAndRow(context, columnId, rowId);
    if (existing) return existing;

    // Validate column exists and is a Doc field
    const column = await Column.get(context, { colId: columnId });
    if (!column) {
      NcError.get(context).fieldNotFound(columnId);
    }

    const userId = req.user?.id;

    const doc = await Document.createForField(context, {
      base_id: context.base_id,
      fk_workspace_id: context.workspace_id,
      fk_column_id: columnId,
      fk_row_id: rowId,
      title: column.title || 'Untitled',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      created_by: userId,
      updated_by: userId,
    });

    if (!doc) {
      NcError.get(context).badRequest('Failed to create document for field');
    }

    return doc;
  }

  /**
   * Update a field-linked document's content.
   * Delegates to the Document model's update method.
   */
  async update(
    context: NcContext,
    docId: string,
    payload: Partial<DocumentType>,
    req: NcRequest,
  ): Promise<DocumentType> {
    const doc = await Document.get(context, docId);

    if (!doc) {
      NcError.get(context).genericNotFound('Document', docId);
    }

    // Only allow updating content, title, and version for field docs
    const updatePayload: Partial<DocumentType> = {
      updated_by: req.user?.id,
    };

    if (payload.content !== undefined) {
      updatePayload.content = payload.content;
    }

    if (payload.title !== undefined) {
      updatePayload.title = payload.title;
    }

    if (payload.version !== undefined) {
      updatePayload.version = payload.version;
    }

    return Document.update(context, docId, updatePayload);
  }

  /**
   * Soft-delete the document for a specific field + row.
   * Called when the user presses Delete on a Doc cell.
   */
  async deleteByFieldAndRow(
    context: NcContext,
    columnId: string,
    rowId: string,
  ): Promise<boolean> {
    const doc = await Document.getByFieldAndRow(context, columnId, rowId);
    if (!doc) return true;

    await Document.softDelete(context, doc.id);
    return true;
  }

  /**
   * Restore a soft-deleted document by its ID.
   * Used for undo after delete or undo after paste.
   */
  async restore(
    context: NcContext,
    docId: string,
  ): Promise<boolean> {
    await Document.restore(context, docId);
    return true;
  }

  /**
   * Duplicate a document from one cell to another.
   * Used for copy-paste: clones the source doc's content into a new doc
   * linked to the target cell. If the target already has a doc, it is
   * soft-deleted first.
   */
  async duplicate(
    context: NcContext,
    params: {
      sourceColumnId: string;
      sourceRowId: string;
      targetColumnId: string;
      targetRowId: string;
    },
    req: NcRequest,
  ): Promise<DocumentType | null> {
    const { sourceColumnId, sourceRowId, targetColumnId, targetRowId } = params;

    // Fetch source document with content
    const sourceDoc = await Document.getByFieldAndRow(
      context,
      sourceColumnId,
      sourceRowId,
    );
    if (!sourceDoc) return null;

    // Delete existing target doc if present
    await this.deleteByFieldAndRow(context, targetColumnId, targetRowId);

    // Deep-clone content so we can mutate node attrs for new FileReference IDs
    const clonedContent = JSON.parse(JSON.stringify(sourceDoc.content));

    // Create new doc with cloned content
    const newDoc = await Document.createForField(context, {
      base_id: context.base_id,
      fk_workspace_id: context.workspace_id,
      fk_column_id: targetColumnId,
      fk_row_id: targetRowId,
      title: sourceDoc.title || 'Untitled',
      content: clonedContent,
      created_by: req.user?.id,
      updated_by: req.user?.id,
    });

    if (!newDoc) return null;

    // Clone FileReferences so the new doc owns its own copies
    try {
      const contentUpdated = await this.cloneFileReferences(
        context,
        newDoc.id!,
        clonedContent,
        req,
      );
      if (contentUpdated) {
        await Document.update(context, newDoc.id!, {
          content: clonedContent,
          version: newDoc.version,
        });
      }
    } catch (e) {
      this.logger.error(
        `Failed to clone file references for duplicated doc field ${newDoc.id}: ${e.message}`,
        e.stack,
      );
    }

    return newDoc;
  }

  /**
   * Walk ProseMirror content tree and create new FileReferences for the new doc.
   * Mutates node.attrs.id in-place with the new FileReference ID.
   * Returns true if any references were cloned (caller must persist content).
   */
  protected async cloneFileReferences(
    context: NcContext,
    newDocId: string,
    content: Record<string, any>,
    req: NcRequest,
  ): Promise<boolean> {
    const nodesToClone: { node: Record<string, any>; oldId: string }[] = [];

    const walk = (node: Record<string, any>) => {
      if (
        (node.type === 'image' || node.type === 'fileAttachment') &&
        node.attrs?.id
      ) {
        nodesToClone.push({ node, oldId: node.attrs.id });
      }
      if (Array.isArray(node.content)) {
        for (const child of node.content) walk(child);
      }
    };
    walk(content);

    if (!nodesToClone.length) return false;

    for (const { node, oldId } of nodesToClone) {
      const original = await FileReference.get(context, oldId);
      if (!original || original.deleted) continue;

      const newId = await FileReference.insert(context, {
        storage: original.storage,
        file_url: original.file_url,
        file_size: original.file_size,
        fk_user_id: req.user?.id ?? 'anonymous',
        fk_doc_id: newDocId,
        is_external: original.is_external,
      });
      node.attrs.id = newId;
    }

    return true;
  }
}
