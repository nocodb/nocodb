import { Logger } from '@nestjs/common';
import * as Y from 'yjs';
import { PubSubRedis } from '~/redis/pubsub-redis';
import { DocumentCollabManager } from '~/socket/DocumentCollabManager';

interface DocSyncPubSubMessage {
  originNodeId: string;
  update: string; // base64-encoded Yjs update (PubSubRedis JSON-serializes)
}

export class DocCollabPubSub {
  protected static logger = new Logger(DocCollabPubSub.name);

  private static unsubscribers = new Map<
    string,
    (keepRedisChannel?: boolean) => Promise<void>
  >();

  private static channel = (docId: string) => `doc-sync:${docId}`;

  /** Subscribe this node to a doc's peer-update channel (idempotent). */
  static async ensureSubscribed(docId: string) {
    if (this.unsubscribers.has(docId) || !PubSubRedis.available) return;
    const unsub = await PubSubRedis.subscribe<DocSyncPubSubMessage>(
      this.channel(docId),
      async (message) => {
        // Ignore our own echo and channels we no longer hold.
        if (!message || message.originNodeId === DocumentCollabManager.nodeId) {
          return;
        }
        const session = DocumentCollabManager.get(docId);
        if (!session) return;
        try {
          Y.applyUpdate(
            session.ydoc,
            Buffer.from(message.update, 'base64'),
            'pubsub',
          );
        } catch (e: any) {
          this.logger.error(
            `Peer update apply failed for ${docId}: ${e.message}`,
            e.stack,
          );
          return;
        }
        // Do NOT re-emit to clients — the socket.io redis-adapter already
        // delivered the client-facing update across nodes.
      },
    );
    if (unsub) this.unsubscribers.set(docId, unsub);
  }

  /** Broadcast a local Y.Doc update to peer nodes (base64 over JSON). */
  static async publishUpdate(docId: string, update: Uint8Array) {
    if (!PubSubRedis.available) return;
    await PubSubRedis.publish(this.channel(docId), {
      originNodeId: DocumentCollabManager.nodeId,
      update: Buffer.from(update).toString('base64'),
    });
  }

  static async unsubscribe(docId: string) {
    const unsub = this.unsubscribers.get(docId);
    if (unsub) {
      await unsub();
      this.unsubscribers.delete(docId);
    }
  }
}
