import { Logger } from '@nestjs/common';
import * as Y from 'yjs';
import { yDocToProsemirrorJSON } from 'y-prosemirror';
import isEqual from 'fast-deep-equal';
import type { NcContext } from 'nocodb-sdk';
import { DocRevisionSource, EventType } from 'nocodb-sdk';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { Document, DocRevision, FileReference } from '~/models';
import NocoSocket from '~/socket/NocoSocket';

const logger = new Logger('documentCollabPersist');

/** Pure helper: merge DB state into the in-memory doc, return new state + derived PM JSON. */
export function mergeYjsState(ydoc: Y.Doc, dbState?: Buffer | null) {
  if (dbState?.length)
    Y.applyUpdate(ydoc, new Uint8Array(dbState), 'persist-merge');
  const state = Buffer.from(Y.encodeStateAsUpdate(ydoc));
  const contentJson = yDocToProsemirrorJSON(ydoc, 'default');
  return { state, contentJson };
}

/** Collect FileReference ids referenced by image/fileAttachment nodes in PM JSON. */
function collectDocFileRefIds(content: any): Set<string> {
  const ids = new Set<string>();
  const walk = (node: any) => {
    if (
      node &&
      (node.type === 'image' || node.type === 'fileAttachment') &&
      node.attrs?.id
    ) {
      ids.add(node.attrs.id);
    }
    if (Array.isArray(node?.content))
      for (const child of node.content) walk(child);
  };
  walk(content);
  return ids;
}

/**
 * Soft-delete FileReferences for attachments removed from a collab-owned body.
 *
 * The lazy reconcile in `DocumentsService.update()` only runs on REST `content`
 * writes, which are skipped while a Yjs session owns the doc — so without this
 * the refs of deleted images would leak. Refs are created eagerly client-side
 * (see `DocumentsService.createDocFileReference`); here we only prune. The cover
 * image ref lives in `meta` (handled by the REST meta path) and is preserved.
 */
async function pruneRemovedFileRefs(
  context: NcContext,
  docId: string,
  contentJson: any,
) {
  const contentIds = collectDocFileRefIds(contentJson);
  const meta = (await Document.getMeta(context, docId))?.meta as
    | Record<string, any>
    | undefined;
  const coverRefId = meta?.cover_image_file_ref_id;
  // Spare recently-created refs: an eager REST ref row exists before its id
  // lands in the Yjs content, so a persist in that gap must not reap it. The
  // grace window is filtered in SQL (against the DB's own stored timestamp) so
  // it never depends on how the driver serializes `created_at` back to JS — a
  // naive (tz-less) string would otherwise shift the cutoff by the conn offset.
  const REF_PRUNE_GRACE_MS = 30_000;
  const graceCutoff = new Date(Date.now() - REF_PRUNE_GRACE_MS);
  const existing = await FileReference.listIdRecordsForDoc(
    context,
    docId,
    undefined,
    graceCutoff,
  );
  const removedIds = existing
    .filter((r) => !contentIds.has(r.id) && r.id !== coverRefId)
    .map((r) => r.id);
  if (removedIds.length) {
    await FileReference.delete(context, removedIds);
  }
}

export async function documentCollabPersist(params: {
  context: NcContext;
  docId: string;
  ydoc: Y.Doc;
  collaborators: string[];
  isLast: boolean;
  /**
   * The collaborative title as of the previous persist (the session watermark).
   * Lets us tell a real in-editor title edit apart from an unchanged title; see
   * `titleEditedInCollab` below.
   */
  lastPersistedTitle: string;
}): Promise<{ persistedTitle: string }> {
  const { context, docId, ydoc, collaborators, lastPersistedTitle } = params;

  // The title shares the document's Y.Doc as a `Y.Text` (see useCollabTitle), so
  // its authoritative value lives here alongside the body. The first client to
  // open a doc seeds it from `nc_docs.title`, so by the time this debounced
  // persist runs the Y.Text holds the real title — an empty Y.Text means the
  // title is genuinely empty (→ the "Untitled" default).
  const rawTitle = ydoc.getText('title').toString();
  const normalizedTitle = rawTitle || 'Untitled';
  const existingDoc = await Document.getMeta(context, docId);

  // Only treat the title as changed when it was actually edited in the editor
  // since our last persist. Without this, an external REST/sidebar rename (which
  // updates `nc_docs.title` but not the shared Y.Text) would be silently
  // clobbered here by re-writing the unchanged Y.Text value back over it.
  const titleEditedInCollab = normalizedTitle !== lastPersistedTitle;
  const titleChanged =
    titleEditedInCollab &&
    !!existingDoc &&
    normalizedTitle !== existingDoc.title;

  // Hoisted so the post-commit FileReference prune can read the derived body.
  let contentJson: any;

  const trxMeta = await Noco.ncDocsContent.startTransaction();
  try {
    const row = await trxMeta
      .knexConnection(MetaTable.DOC_CONTENT)
      .where({ base_id: context.base_id, fk_doc_id: docId })
      .forUpdate()
      .first();

    const merged = mergeYjsState(ydoc, row?.yjs_state);
    const state = merged.state;
    contentJson = merged.contentJson;

    const existingContent = row?.content
      ? typeof row.content === 'string'
        ? JSON.parse(row.content)
        : row.content
      : undefined;

    const contentUnchanged = !!(
      row &&
      existingContent &&
      isEqual(existingContent, contentJson)
    );

    if (contentUnchanged && !titleChanged) {
      await trxMeta.commit();
      // neither body nor an in-editor title edit — skip write + revision
      return { persistedTitle: normalizedTitle };
    }

    // `yjs_state` encodes both the body and the title, so it always advances when
    // we persist; the derived `content` JSON only needs rewriting when the body
    // actually changed (a title-only edit leaves it identical).
    const update: Record<string, any> = {
      yjs_state: state,
      updated_at: new Date(),
    };
    if (!contentUnchanged) update.content = JSON.stringify(contentJson);

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

  // version bump on the meta DB (advisory, separate connection); also persists the
  // collaborative title when it changed.
  const lastEditor = collaborators[collaborators.length - 1];
  const bumped = await Document.bumpVersion(
    context,
    docId,
    lastEditor,
    undefined,
    // Only push the collaborative title when it was edited in the editor — never
    // overwrite an external rename with the unchanged Y.Text value.
    titleChanged ? normalizedTitle : undefined,
  );

  // Push the new title to every base client. Editors with the doc open already
  // have it live via the Y.Text sync; this updates the sidebar / breadcrumb /
  // URL slug for clients that don't currently hold the doc open.
  if (bumped?.titleChanged) {
    try {
      const fresh = await Document.getMeta(context, docId);
      if (fresh) {
        NocoSocket.broadcastEvent(context, {
          event: EventType.DOCUMENT_EVENT,
          payload: { id: docId, action: 'update', payload: fresh },
        });
      }
    } catch (e: any) {
      logger.error(
        `title broadcast failed for ${docId}: ${e.message}`,
        e.stack,
      );
    }
  }

  // revision snapshot, from values captured by THIS persist (contentJson + the
  // bumped version) — re-reading via Document.get could race a concurrent peer
  // write and tag the revision with another write's content/version.
  if (bumped && contentJson) {
    try {
      await DocRevision.record(context, {
        docId,
        version: bumped.version,
        content: contentJson,
        title: normalizedTitle,
        createdBy: lastEditor,
        source: DocRevisionSource.AUTO,
      });
    } catch (e: any) {
      logger.error(
        `revision record failed for ${docId}: ${e.message}`,
        e.stack,
      );
    }
  }

  // Prune FileReferences whose attachments were removed from the body. Never
  // fail the persist on a cleanup error — the content write already committed.
  try {
    await pruneRemovedFileRefs(context, docId, contentJson);
  } catch (e: any) {
    logger.error(`file-ref cleanup failed for ${docId}: ${e.message}`, e.stack);
  }

  return { persistedTitle: normalizedTitle };
}
