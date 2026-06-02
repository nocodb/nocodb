import { Logger } from '@nestjs/common';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import type { NcContext } from 'nocodb-sdk';
import Noco from '~/Noco';
import { DocCollabPubSub } from '~/socket/DocCollabPubSub';
import { CacheScope, MetaTable } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { documentCollabPersist } from '~/commands/documentCollabPersist';

interface DocSession {
  ydoc: Y.Doc;
  awareness: Awareness;
  context: NcContext;
  localSockets: Set<string>;
  dirty: boolean;
  collaborators: Set<string>;
  debounceTimer?: NodeJS.Timeout;
  maxDebounceTimer?: NodeJS.Timeout;
  heartbeatTimer?: NodeJS.Timeout;
}

const DEBOUNCE_MS = 3000;
const MAX_DEBOUNCE_MS = 10000;
const HOLDER_TTL_SECS = 60;
const HOLDER_HEARTBEAT_MS = 30000;

export class DocumentCollabManager {
  protected static logger = new Logger(DocumentCollabManager.name);

  private static sessions = new Map<string, DocSession>();

  /** Stable per-process id for PubSubRedis echo suppression + holder set. */
  public static nodeId = `${process.pid}-${Math.floor(
    process.uptime() * 1000,
  )}`;

  static get(docId: string): DocSession | undefined {
    return this.sessions.get(docId);
  }

  static isLiveLocal(docId: string): boolean {
    return this.sessions.has(docId);
  }

  /** First local connection: load state, mark holder, return the session. */
  static async ensure(context: NcContext, docId: string): Promise<DocSession> {
    let session = this.sessions.get(docId);
    if (session) return session;

    const ydoc = new Y.Doc();
    const stateRow = await Noco.ncDocsContent
      .knexConnection(MetaTable.DOC_CONTENT)
      .where({ base_id: context.base_id, fk_doc_id: docId })
      .first('yjs_state');
    if (stateRow?.yjs_state) {
      Y.applyUpdate(ydoc, new Uint8Array(stateRow.yjs_state));
    }

    session = {
      ydoc,
      awareness: new Awareness(ydoc),
      context,
      localSockets: new Set(),
      dirty: false,
      collaborators: new Set(),
    };
    this.sessions.set(docId, session);

    // Multi-node "doc is live" holder key for the REST coherence gate.
    // Refreshed on a heartbeat so it survives idle-but-open sessions and
    // self-expires if this node dies. No-op without Redis (single-node uses
    // isLiveLocal()).
    await this.touchHolder(context, docId);
    session.heartbeatTimer = setInterval(
      () => void this.touchHolder(context, docId),
      HOLDER_HEARTBEAT_MS,
    );

    return session;
  }

  private static async touchHolder(context: NcContext, docId: string) {
    try {
      await NocoCache.setHashField(
        context,
        CacheScope.DOC_LIVE,
        docId,
        this.nodeId,
      );
      await NocoCache.expireHash(context, CacheScope.DOC_LIVE, HOLDER_TTL_SECS);
    } catch {
      // Redis unavailable / cache disabled — single-node path uses isLiveLocal().
    }
  }

  static addSocket(docId: string, socketId: string) {
    this.sessions.get(docId)?.localSockets.add(socketId);
  }

  static markDirty(docId: string, userId?: string) {
    const s = this.sessions.get(docId);
    if (!s) return;
    s.dirty = true;
    if (userId) s.collaborators.add(userId);
    this.schedulePersist(docId);
  }

  private static schedulePersist(docId: string) {
    const s = this.sessions.get(docId);
    if (!s) return;
    if (s.debounceTimer) clearTimeout(s.debounceTimer);
    s.debounceTimer = setTimeout(() => void this.flush(docId), DEBOUNCE_MS);
    if (!s.maxDebounceTimer) {
      s.maxDebounceTimer = setTimeout(
        () => void this.flush(docId),
        MAX_DEBOUNCE_MS,
      );
    }
  }

  static async flush(docId: string, isLast = false) {
    const s = this.sessions.get(docId);
    if (!s || (!s.dirty && !isLast)) return;
    if (s.debounceTimer) clearTimeout(s.debounceTimer);
    if (s.maxDebounceTimer) clearTimeout(s.maxDebounceTimer);
    s.debounceTimer = s.maxDebounceTimer = undefined;
    const collaborators = [...s.collaborators];
    s.dirty = false;
    s.collaborators.clear();
    try {
      await documentCollabPersist({
        context: s.context,
        docId,
        ydoc: s.ydoc,
        collaborators,
        isLast,
      });
    } catch (e: any) {
      this.logger.error(`persist failed for ${docId}: ${e.message}`, e.stack);
      s.dirty = true; // retry next tick
    }
  }

  /** Last local connection gone: final persist + teardown. */
  static async release(docId: string, socketId: string) {
    const s = this.sessions.get(docId);
    if (!s) return;
    s.localSockets.delete(socketId);
    if (s.localSockets.size > 0) return;
    await this.flush(docId, true);
    if (s.heartbeatTimer) clearInterval(s.heartbeatTimer);
    s.awareness.destroy();
    s.ydoc.destroy();
    await DocCollabPubSub.unsubscribe(docId);
    this.sessions.delete(docId);
    try {
      await NocoCache.delHashField(s.context, CacheScope.DOC_LIVE, docId);
    } catch {
      // ignore
    }
  }
}
