import 'mocha';
import { expect } from 'chai';
import { EventEmitter } from 'events';
import { PubSubRedis } from '~/redis/pubsub-redis';

export function pubSubRedisDemuxTests() {
  describe('PubSubRedis demux + ref-counting', () => {
    let fakeSub: any;
    let subscribeCalls: string[];
    let unsubscribeCalls: string[];
    // Snapshot real statics so we never pollute the shared test process.
    let orig: Record<string, any>;

    before(() => {
      orig = {
        redisSubscriber: (PubSubRedis as any).redisSubscriber,
        handlers: (PubSubRedis as any).handlers,
        messageListenerBound: (PubSubRedis as any).messageListenerBound,
        initialized: PubSubRedis.initialized,
        available: PubSubRedis.available,
      };
    });

    after(() => {
      (PubSubRedis as any).redisSubscriber = orig.redisSubscriber;
      (PubSubRedis as any).handlers = orig.handlers;
      (PubSubRedis as any).messageListenerBound = orig.messageListenerBound;
      PubSubRedis.initialized = orig.initialized;
      PubSubRedis.available = orig.available;
    });

    beforeEach(() => {
      subscribeCalls = [];
      unsubscribeCalls = [];
      fakeSub = new EventEmitter() as any;
      fakeSub.subscribe = async (ch: string) => {
        subscribeCalls.push(ch);
      };
      fakeSub.unsubscribe = async (ch: string) => {
        unsubscribeCalls.push(ch);
      };
      (PubSubRedis as any).redisSubscriber = fakeSub;
      (PubSubRedis as any).handlers = new Map();
      (PubSubRedis as any).messageListenerBound = false;
      PubSubRedis.initialized = true;
      PubSubRedis.available = true;
    });

    it('registers exactly one message listener regardless of channel count', async () => {
      await PubSubRedis.subscribe('a', async () => {});
      await PubSubRedis.subscribe('b', async () => {});
      await PubSubRedis.subscribe('c', async () => {});
      expect(fakeSub.listenerCount('message')).to.equal(1);
    });

    it('subscribes the redis channel once and dispatches to all handlers', async () => {
      const got: string[] = [];
      await PubSubRedis.subscribe('chan', async (m: any) => {
        got.push('h1:' + m.v);
      });
      await PubSubRedis.subscribe('chan', async (m: any) => {
        got.push('h2:' + m.v);
      });
      expect(subscribeCalls).to.deep.equal(['chan']); // only the first subscribes

      fakeSub.emit('message', 'chan', JSON.stringify({ v: 1 }));
      await new Promise((r) => setImmediate(r));
      expect(got).to.have.members(['h1:1', 'h2:1']);
    });

    it('only unsubscribes the redis channel when the last handler is removed', async () => {
      const u1 = await PubSubRedis.subscribe('chan', async () => {});
      const u2 = await PubSubRedis.subscribe('chan', async () => {});
      await u1();
      expect(unsubscribeCalls).to.deep.equal([]); // one handler still left
      await u2();
      expect(unsubscribeCalls).to.deep.equal(['chan']);
    });

    it('does not deliver a channel message to another channel handler', async () => {
      const got: string[] = [];
      await PubSubRedis.subscribe('a', async () => {
        got.push('a');
      });
      await PubSubRedis.subscribe('b', async () => {
        got.push('b');
      });
      fakeSub.emit('message', 'a', JSON.stringify({}));
      await new Promise((r) => setImmediate(r));
      expect(got).to.deep.equal(['a']);
    });
  });
}
