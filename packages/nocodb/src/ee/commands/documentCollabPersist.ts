import { Logger } from '@nestjs/common';
import * as Y from 'yjs';
import { yDocToProsemirrorJSON } from 'y-prosemirror';
import isEqual from 'fast-deep-equal';
import type { NcContext } from 'nocodb-sdk';
import { DocRevisionSource } from 'nocodb-sdk';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { Document, DocRevision } from '~/models';

const logger = new Logger('documentCollabPersist');

/** Pure helper: merge DB state into the in-memory doc, return new state + derived PM JSON. */
export function mergeYjsState(ydoc: Y.Doc, dbState?: Buffer | null) {
  if (dbState?.length) Y.applyUpdate(ydoc, new Uint8Array(dbState), 'persist-merge');
  const state = Buffer.from(Y.encodeStateAsUpdate(ydoc));
  const contentJson = yDocToProsemirrorJSON(ydoc, 'default');
  return { state, contentJson };
}

export async function documentCollabPersist(params: {
  context: NcContext;
  docId: string;
  ydoc: Y.Doc;
  collaborators: string[];
  isLast: boolean;
}) {
  const { context, docId, ydoc, collaborators } = params;

  const trxMeta = await Noco.ncDocsContent.startTransaction();
  try {
    const row = await trxMeta
      .knexConnection(MetaTable.DOC_CONTENT)
      .where({ base_id: context.base_id, fk_doc_id: docId })
      .forUpdate()
      .first();

    const { state, contentJson } = mergeYjsState(ydoc, row?.yjs_state);

    const existingContent = row?.content
      ? typeof row.content === 'string'
        ? JSON.parse(row.content)
        : row.content
      : undefined;

    if (row && existingContent && isEqual(existingContent, contentJson)) {
      await trxMeta.commit();
      return; // unchanged — skip write + revision
    }

    const update = {
      yjs_state: state,
      content: JSON.stringify(contentJson),
      updated_at: new Date(),
    };

    if (row) {
      await trxMeta
        .knexConnection(MetaTable.DOC_CONTENT)
        .where({ base_id: context.base_id, fk_doc_id: docId })
        .update(update);
    } else {
      await trxMeta.knexConnection(MetaTable.DOC_CONTENT).insert({
        base_id: context.base_id,
        fk_workspace_id: context.workspace_id,
        fk_doc_id: docId,
        ...update,
      });
    }

    await trxMeta.commit();
  } catch (e: any) {
    await trxMeta.rollback(e);
    throw e;
  }

  // version bump on the meta DB (advisory, separate connection).
  const lastEditor = collaborators[collaborators.length - 1];
  await Document.bumpVersion(context, docId, lastEditor);

  // revision snapshot (PM JSON), attributed to the last editor.
  try {
    const doc = await Document.get(context, docId);
    if (doc?.content) {
      await DocRevision.record(context, {
        docId,
        version: doc.version!,
        content: doc.content,
        title: doc.title!,
        createdBy: lastEditor,
        source: DocRevisionSource.AUTO,
      });
    }
  } catch (e: any) {
    logger.error(`revision record failed for ${docId}: ${e.message}`, e.stack);
  }
}
