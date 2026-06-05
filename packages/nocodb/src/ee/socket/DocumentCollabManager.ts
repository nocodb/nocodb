import { Logger } from '@nestjs/common';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import type { NcContext } from 'nocodb-sdk';
import Noco from '~/Noco';
import { DocCollabPubSub } from '~/socket/DocCollabPubSub';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { documentCollabPersist } from '~/commands/documentCollabPersist';

interface DocSession {
  ydoc: Y.Doc;
  awareness: Awareness;
  context: NcContext;
  localSockets: Set<string>;
  dirty: boolean;
  collaborators: Set<string>;
  /** True when the server Y.Doc was empty at load (no persisted yjs_state). */
  wasEmpty: boolean;
  /** Set once a client has been granted the right to seed an empty doc. */
  bootstrapClaimed: boolean;
  debounceTimer?: NodeJS.Timeout;
  maxDebounceTimer?: NodeJS.Timeout;
  heartbeatTimer?: NodeJS.Timeout;
}

// Debounced persist window. Configurable so the E2E backend can shorten it
// (the Playwright suite asserts on per-edit persistence / revision cadence and
// would otherwise race the default 3s debounce). Production default unchanged.
const DEBOUNCE_MS = process.env.NC_DOCS_PERSIST_DEBOUNCE_MS
  ? Number(process.env.NC_DOCS_PERSIST_DEBOUNCE_MS)
  : 3000;
const MAX_DEBOUNCE_MS = Math.max(10000, DEBOUNCE_MS);
const HOLDER_TTL_SECS = 60;
const HOLDER_HEARTBEAT_MS = 30000;
/** TTL on the cross-node bootstrap claim; long enough to seed + persist. */
const BOOTSTRAP_TTL_SECS = 60;
/** Bounded retries for the final (last-socket) persist before giving up. */
const FINAL_FLUSH_RETRIES = 3;
const FINAL_FLUSH_BACKOFF_MS = 500;
/** TTL on the per-doc persist lock — held only for the duration of a write, so
 *  this only needs to exceed a slow persist; it self-expires if the writer dies. */
const PERSIST_LOCK_TTL_SECS = 15;

/** Per-doc Redis key for the multi-node "doc is live" holder (see isLive). */
const liveKey = (docId: string) => `${CacheScope.DOC_LIVE}:${docId}`;
/** Per-doc Redis key for the single-seeder bootstrap claim (see claimBootstrap). */
const bootstrapKey = (docId: string) => `${CacheScope.DOC_BOOTSTRAP}:${docId}`;
/** Per-doc Redis key for the best-effort single-writer persist lock (see flush). */
const persistLockKey = (docId: string) =>
  `${CacheScope.DOC_PERSIST_LOCK}:${docId}`;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

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

  static sessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Multi-node aware liveness for the REST coherence gate: a local session,
   * or a holder key set by another node (Redis). False without Redis when no
   * local session holds the doc.
   */
  static async isLive(context: NcContext, docId: string): Promise<boolean> {
    if (this.isLiveLocal(docId)) return true;
    try {
      const holder = await NocoCache.get(
        context,
        liveKey(docId),
        CacheGetType.TYPE_STRING,
      );
      return !!holder;
    } catch {
      return false;
    }
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
      wasEmpty: !stateRow?.yjs_state,
      bootstrapClaimed: false,
    };
    this.sessions.set(docId, session);
    this.logger.debug(
      `doc session opened ${docId} (live local sessions: ${this.sessions.size})`,
    );

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
      // Per-doc key with its own TTL — a sibling doc's heartbeat must not keep a
      // crashed node's stale holder alive (which would wrongly mark this doc live
      // and have the REST coherence gate reject body writes indefinitely).
      await NocoCache.setExpiring(
        context,
        liveKey(docId),
        this.nodeId,
        HOLDER_TTL_SECS,
      );
    } catch {
      // Redis unavailable / cache disabled — single-node path uses isLiveLocal().
    }
  }

  /**
   * Best-effort per-doc persist lock. NOT a safety lock — the `FOR UPDATE` row
   * lock + content-unchanged guard in documentCollabPersist are the correctness
   * backstop. Without Redis there's only one node, so we always own the write.
   */
  private static async acquirePersistLock(
    context: NcContext,
    docId: string,
  ): Promise<boolean> {
    try {
      return await NocoCache.setIfNotExist(
        context,
        persistLockKey(docId),
        this.nodeId,
        PERSIST_LOCK_TTL_SECS,
      );
    } catch {
      return true; // no Redis / cache disabled → single node → always the writer
    }
  }

  private static async releasePersistLock(
    context: NcContext,
    docId: string,
  ): Promise<void> {
    try {
      await NocoCache.del(context, persistLockKey(docId));
    } catch {
      // ignore — the lock self-expires via TTL.
    }
  }

  /**
   * Grant exactly one client the right to seed an empty (legacy) doc into the
   * CRDT. The server can't seed itself (no ProseMirror schema backend-side), so
   * the first eligible subscriber migrates the stored content — but two clients
   * seeding concurrently would merge into duplicated body/title content. This
   * arbitrates:
   *
   * - In-memory `bootstrapClaimed` is set synchronously (no await before the
   *   write) so same-node concurrent subscribers can't both win.
   * - Cross-node, a Redis `SET NX` ensures only one node's client seeds. With
   *   cache disabled (single node) `setIfNotExist` returns true, so the
   *   in-memory claim alone is authoritative.
   *
   * The caller must only invoke this for clients that can edit — a read-only
   * client's seed would be rejected by the update handler and never persist,
   * and granting it would block an editor from seeding. Returns whether the
   * caller may seed.
   */
  static async claimBootstrap(
    context: NcContext,
    docId: string,
  ): Promise<boolean> {
    const s = this.sessions.get(docId);
    if (!s || !s.wasEmpty || s.bootstrapClaimed) return false;
    s.bootstrapClaimed = true; // synchronous — wins the same-node race
    try {
      return await NocoCache.setIfNotExist(
        context,
        bootstrapKey(docId),
        this.nodeId,
        BOOTSTRAP_TTL_SECS,
      );
    } catch {
      // No Redis — single node; the in-memory claim is authoritative.
      return true;
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

  /**
   * Persist the doc. Returns true on success (or when there was nothing to do),
   * false when the persist threw. On a non-final failure the debounce timers are
   * re-armed so the write is retried without waiting for the next edit.
   */
  static async flush(docId: string, isLast = false): Promise<boolean> {
    const s = this.sessions.get(docId);
    if (!s || (!s.dirty && !isLast)) return true;

    // Single-writer optimization (Hocuspocus-style): only one node persists a
    // given doc per write. Perf dedup only — correctness is still guaranteed by
    // documentCollabPersist's FOR UPDATE row lock + content-unchanged guard. The
    // lock is held only across the write, so contention windows are sub-second.
    const gotLock = await this.acquirePersistLock(s.context, docId);
    if (!gotLock) {
      // A peer holds this cycle's write. It has our edits (converged via
      // DocCollabPubSub) and will persist them, so skipping is lossless. The
      // final flush must still land the converged state, so signal the caller's
      // bounded retry loop (release) to re-attempt once the peer releases.
      if (isLast) return false;
      this.schedulePersist(docId);
      return true;
    }

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
      return true;
    } catch (e: any) {
      this.logger.error(`persist failed for ${docId}: ${e.message}`, e.stack);
      s.dirty = true;
      // Re-add the attribution we cleared pre-persist so the retry keeps the
      // correct lastEditor (else updated_by/revision author → undefined).
      for (const c of collaborators) s.collaborators.add(c);
      // Re-arm a retry; the final-flush path (isLast) drives its own retry loop
      // in release(), where the session is about to be torn down.
      if (!isLast) this.schedulePersist(docId);
      return false;
    } finally {
      await this.releasePersistLock(s.context, docId);
    }
  }

  /** Last local connection gone: final persist + teardown. */
  static async release(docId: string, socketId: string) {
    const s = this.sessions.get(docId);
    if (!s) return;
    s.localSockets.delete(socketId);
    if (s.localSockets.size > 0) return;

    // Final persist with bounded retry — the Y.Doc is about to be destroyed, so
    // a transient DB error here would otherwise silently lose unpersisted edits.
    let persisted = await this.flush(docId, true);
    for (
      let attempt = 1;
      !persisted && attempt <= FINAL_FLUSH_RETRIES;
      attempt++
    ) {
      await sleep(FINAL_FLUSH_BACKOFF_MS * attempt);
      persisted = await this.flush(docId, true);
    }
    if (!persisted) {
      this.logger.error(
        `final persist for ${docId} failed after ${FINAL_FLUSH_RETRIES} retries — unsaved collaborative edits may be lost`,
      );
    }

    // A client may have re-subscribed while we were flushing (ensure() returns
    // this same session until it's deleted below). If so, abort teardown and
    // keep the doc live — destroying the Y.Doc now would orphan that client.
    if (s.localSockets.size > 0) return;

    if (s.heartbeatTimer) clearInterval(s.heartbeatTimer);
    s.awareness.destroy();
    s.ydoc.destroy();
    await DocCollabPubSub.unsubscribe(docId);
    this.sessions.delete(docId);
    try {
      await NocoCache.del(s.context, liveKey(docId));
      // If the doc never got seeded (still empty), release the bootstrap claim
      // so the next session can re-grant — otherwise a legacy doc whose sole
      // seeder vanished before seeding would stay un-migrated until TTL expiry.
      if (s.wasEmpty) {
        await NocoCache.del(s.context, bootstrapKey(docId));
      }
    } catch {
      // ignore
    }
  }
}
