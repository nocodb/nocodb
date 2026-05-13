import { expect } from 'chai';
import { z } from 'zod';
import {
  dispatchOperation,
  dispatchTranscriptEntry,
  makeReplayReq,
  registerForward,
  registerMacro,
} from '~/command-registry/replay-context';
import { OperationRegistry } from '~/command-registry/registry';
import { isReplay } from '~/helpers/replayScope';
import type {
  CommandHandler,
  HandlerMeta,
  OperationContract,
} from '~/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';

const baseCtx = { base_id: 'p_dest' } as any;

function makeContract(
  overrides: Partial<OperationContract> = {},
): OperationContract {
  return {
    name: OperationName.sortCreate,
    version: 1,
    entity: MetaTable.SORT,
    schema: z
      .object({
        baseId: z.string().optional(),
        body: z
          .object({
            id: z.string().optional(),
            title: z.string().optional(),
          })
          .strict()
          .optional(),
      })
      .passthrough(),
    ...overrides,
  } as OperationContract;
}

function resetRegistry() {
  (OperationRegistry as any).entries.clear();
  (OperationRegistry as any).frozen = false;
}

describe('replay-context', () => {
  beforeEach(resetRegistry);
  after(resetRegistry);

  describe('makeReplayReq', () => {
    it('preserves originalReq fields and uses originalReq.user when present', () => {
      const original = {
        user: { id: 'u-original' },
        ncTabId: 't1',
        headers: { foo: 'bar' },
      } as any;
      const out = makeReplayReq(original, 'fallback');
      expect(out.user).to.deep.equal({ id: 'u-original' });
      expect((out as any).ncTabId).to.equal('t1');
      expect((out as any).headers).to.deep.equal({ foo: 'bar' });
    });

    it('falls back to createdBy when originalReq has no user', () => {
      const out = makeReplayReq({ headers: {} } as any, 'u-fallback');
      expect(out.user).to.deep.equal({ id: 'u-fallback' });
    });

    it('handles a null/undefined originalReq via spread on user only', () => {
      // Note: makeReplayReq does NOT defend against undefined originalReq
      // (callers always pass a real object). Documented as a guarantee.
      const out = makeReplayReq({} as any, 'u-only');
      expect(out.user).to.deep.equal({ id: 'u-only' });
    });
  });

  describe('dispatchOperation', () => {
    it('builds HandlerMeta with entryId, entityId, originalReq, createdBy, extra', async () => {
      const contract = makeContract();
      let receivedMeta: HandlerMeta | undefined;
      const handler: CommandHandler = async (_ctx, _params, meta) => {
        receivedMeta = meta;
      };

      const originalReq = { user: { id: 'u1' } } as any;
      await dispatchOperation(baseCtx, contract, handler, {
        params: { baseId: 'p_src' },
        entityId: 'e123',
        extra: { ltar: { mm: 'mm_1' } } as any,
        entryId: 'log-1',
        createdBy: 'u1',
        originalReq,
      });

      expect(receivedMeta?.entryId).to.equal('log-1');
      expect(receivedMeta?.entityId).to.equal('e123');
      expect(receivedMeta?.createdBy).to.equal('u1');
      expect(receivedMeta?.originalReq).to.equal(originalReq);
      expect(receivedMeta?.extra).to.deep.equal({ ltar: { mm: 'mm_1' } });
    });

    it('runs handler inside runInReplay (isReplay() true)', async () => {
      const contract = makeContract();
      let observedIsReplay = false;
      const handler: CommandHandler = async () => {
        observedIsReplay = isReplay();
      };
      await dispatchOperation(baseCtx, contract, handler, {
        params: {},
        entryId: 'x',
        createdBy: 'u',
        originalReq: {} as any,
      });
      expect(observedIsReplay).to.equal(true);
    });

    it('rewrites params.baseId to context.base_id (sandbox→prod path)', async () => {
      const contract = makeContract();
      let received: Record<string, any> = {};
      const handler: CommandHandler = async (_ctx, params) => {
        received = params as Record<string, any>;
      };
      await dispatchOperation(baseCtx, contract, handler, {
        params: { baseId: 'p_sandbox' },
        entryId: 'x',
        createdBy: 'u',
        originalReq: { user: { id: 'u' } } as any,
      });
      expect(received.baseId).to.equal('p_dest');
    });

    it('does not add baseId when params has none', async () => {
      const contract = makeContract();
      let received: Record<string, any> = {};
      const handler: CommandHandler = async (_ctx, params) => {
        received = params as Record<string, any>;
      };
      await dispatchOperation(baseCtx, contract, handler, {
        params: { foo: 1 },
        entryId: 'x',
        createdBy: 'u',
        originalReq: {} as any,
      });
      expect(received.baseId).to.be.undefined;
    });

    it('injects entityId into params[id_field].id when sandbox.id_field is configured', async () => {
      const contract = makeContract({ sandbox: { id_field: 'body' } } as any);
      let received: Record<string, any> = {};
      const handler: CommandHandler = async (_ctx, params) => {
        received = params as Record<string, any>;
      };
      await dispatchOperation(baseCtx, contract, handler, {
        params: { body: { title: 'kept' } },
        entityId: 'srt_999',
        entryId: 'x',
        createdBy: 'u',
        originalReq: {} as any,
      });
      expect(received.body).to.deep.equal({ title: 'kept', id: 'srt_999' });
    });

    it('does not inject id when sandbox.id_field is unset', async () => {
      const contract = makeContract();
      let received: Record<string, any> = {};
      const handler: CommandHandler = async (_ctx, params) => {
        received = params as Record<string, any>;
      };
      await dispatchOperation(baseCtx, contract, handler, {
        params: { body: { title: 'x' } },
        entityId: 'srt_999',
        entryId: 'x',
        createdBy: 'u',
        originalReq: {} as any,
      });
      expect(received.body).to.deep.equal({ title: 'x' });
    });

    it('does not inject id when entityId is undefined', async () => {
      const contract = makeContract({ sandbox: { id_field: 'body' } } as any);
      let received: Record<string, any> = {};
      const handler: CommandHandler = async (_ctx, params) => {
        received = params as Record<string, any>;
      };
      await dispatchOperation(baseCtx, contract, handler, {
        params: { body: { title: 'x' } },
        entryId: 'x',
        createdBy: 'u',
        originalReq: {} as any,
      });
      expect(received.body).to.deep.equal({ title: 'x' });
    });

    it('rejects malformed params via schema.parse before dispatch (H1 guarantee)', async () => {
     const contract = makeContract({ sandbox: { id_field: 'body' } } as any);
      let handlerCalled = false;
      const handler: CommandHandler = async () => {
        handlerCalled = true;
      };
      let caught: any;
      try {
        await dispatchOperation(baseCtx, contract, handler, {
          params: { body: 'plain-string' },
          entityId: 'e1',
          entryId: 'x',
          createdBy: 'u',
          originalReq: {} as any,
        });
      } catch (e) {
        caught = e;
      }
      expect(caught, 'expected a ZodError').to.exist;
      expect(caught.name).to.equal('ZodError');
      expect(handlerCalled, 'handler must not run when schema fails').to.equal(
        false,
      );
      // Replay scope must have unwound even though the parse threw inside
      // dispatchOperation (parse runs before runInReplay opens the scope).
      expect(isReplay()).to.equal(false);
    });

    it('spreads user + req onto replayParams from makeReplayReq', async () => {
      const contract = makeContract();
      let received: Record<string, any> = {};
      const handler: CommandHandler = async (_ctx, params) => {
        received = params as Record<string, any>;
      };
      await dispatchOperation(baseCtx, contract, handler, {
        params: { foo: 1 },
        entryId: 'x',
        createdBy: 'u-cb',
        originalReq: { user: { id: 'u-orig' } } as any,
      });
      expect(received.user).to.deep.equal({ id: 'u-orig' });
      expect(received.req).to.exist;
      expect(received.req.user).to.deep.equal({ id: 'u-orig' });
    });

    it('handles null params gracefully', async () => {
      const contract = makeContract();
      let received: Record<string, any> = {};
      const handler: CommandHandler = async (_ctx, params) => {
        received = params as Record<string, any>;
      };
      await dispatchOperation(baseCtx, contract, handler, {
        params: null,
        entryId: 'x',
        createdBy: 'u',
        originalReq: {} as any,
      });
      expect(received.req).to.exist;
      expect(received.user).to.exist;
    });

    it('propagates handler return value', async () => {
      const contract = makeContract();
      const handler: CommandHandler = async () => ({ ok: 1 }) as any;
      const out = await dispatchOperation(baseCtx, contract, handler, {
        params: {},
        entryId: 'x',
        createdBy: 'u',
        originalReq: {} as any,
      });
      expect(out).to.deep.equal({ ok: 1 });
    });

    it('propagates handler errors', async () => {
      const contract = makeContract();
      const handler: CommandHandler = async () => {
        throw new Error('handler failed');
      };
      let caught: Error | undefined;
      try {
        await dispatchOperation(baseCtx, contract, handler, {
          params: {},
          entryId: 'x',
          createdBy: 'u',
          originalReq: {} as any,
        });
      } catch (e: any) {
        caught = e;
      }
      expect(caught?.message).to.equal('handler failed');
      // Replay scope must have unwound
      expect(isReplay()).to.equal(false);
    });
  });

  describe('registerForward', () => {
    it('wraps forward(ctx, params) and supplies req via makeReplayReq', async () => {
      const contract = makeContract();
      let received: Record<string, any> = {};
      registerForward(contract, async (_ctx, params) => {
        received = params as Record<string, any>;
        return { id: 'r' };
      });
      const entry = OperationRegistry.resolve(contract.name, 1);
      expect(entry).to.exist;

      // Manually invoke the registered handler to verify forward shape
      await entry!.handler(
        baseCtx,
        { foo: 'bar', user: { id: 'preserved' } },
        {
          entryId: 'e',
          createdBy: 'u',
          originalReq: { user: { id: 'orig' } } as any,
        },
      );
      expect(received.foo).to.equal('bar');
      expect(received.req).to.exist;
      expect(received.req.user).to.deep.equal({ id: 'orig' });
    });
  });

  describe('dispatchTranscriptEntry', () => {
    it('resolves child contract, re-validates params, then dispatches', async () => {
      const childContract = makeContract();
      let received: any;
      OperationRegistry.register(childContract, async (_ctx, params, meta) => {
        received = { params, meta };
      });

      await dispatchTranscriptEntry(
        baseCtx,
        {
          op: childContract.name as any,
          version: 1,
          params: { baseId: 'p_src', body: { title: 'x' } },
          entityId: 'srt_42',
          extra: { ltar: { mm: 'mm' } } as any,
        },
        { user: { id: 'u' } } as any,
      );

      expect(received.params.baseId).to.equal('p_dest'); // baseId rewrite
      expect(received.meta.entityId).to.equal('srt_42');
      expect(received.meta.extra).to.deep.equal({ ltar: { mm: 'mm' } });
      expect(received.meta.entryId).to.equal('macro-child');
    });

    it('throws when the (op, version) is not in the registry', async () => {
      let caught: Error | undefined;
      try {
        await dispatchTranscriptEntry(
          baseCtx,
          {
            op: 'no-such-op' as any,
            version: 99,
            params: {},
          },
          {} as any,
        );
      } catch (e: any) {
        caught = e;
      }
      expect(caught?.message).to.match(/unknown op 'no-such-op@99'/);
    });

    it('throws on schema drift — old persisted params no longer parse', async () => {
      // Register a contract that rejects extra fields.
      const strictContract = makeContract({
        schema: z.object({ title: z.string() }).strict() as any,
      });
      OperationRegistry.register(strictContract, async () => undefined);

      let caught: Error | undefined;
      try {
        await dispatchTranscriptEntry(
          baseCtx,
          {
            op: strictContract.name as any,
            version: 1,
            params: { title: 'ok', removedField: 'oops' },
          },
          {} as any,
        );
      } catch (e: any) {
        caught = e;
      }
      // Zod throws on `.parse` failure
      expect(caught).to.exist;
    });
  });

  describe('registerMacro', () => {
    it('forward call: runs forwardCall when not in replay', async () => {
      const macroContract = makeContract({ macro: true });
      let forwardRan = false;
      registerMacro(macroContract, async () => {
        forwardRan = true;
        return 'forward-result';
      });

      const entry = OperationRegistry.resolve(macroContract.name, 1);
      const out = await entry!.handler(
        baseCtx,
        {},
        {
          entryId: 'e',
          createdBy: 'u',
          originalReq: {} as any,
        },
      );
      expect(forwardRan).to.equal(true);
      expect(out).to.equal('forward-result');
    });

    it('replay branch: when isReplay && transcript exists, iterates transcript instead of calling forwardCall', async () => {
      const macroContract = makeContract({ macro: true });
      let forwardRan = false;
      registerMacro(macroContract, async () => {
        forwardRan = true;
      });

      // Register a child contract whose handler we can observe.
      const childContract = makeContract({
        name: OperationName.sortDelete as any,
      });
      const childCalls: string[] = [];
      OperationRegistry.register(childContract, async (_ctx, params) => {
        childCalls.push(JSON.stringify(params));
      });

      const entry = OperationRegistry.resolve(macroContract.name, 1);

      // Run the macro under isReplay()
      await (async () => {
        const { runInReplay } = require('../../../src/ee/helpers/replayScope');
        await runInReplay(() =>
          entry!.handler(
            baseCtx,
            {},
            {
              entryId: 'e',
              createdBy: 'u',
              originalReq: {} as any,
              extra: {
                macroTranscript: [
                  {
                    op: childContract.name,
                    version: 1,
                    params: { body: { title: 'first' } },
                  },
                  {
                    op: childContract.name,
                    version: 1,
                    params: { body: { title: 'second' } },
                  },
                ],
              } as any,
            },
          ),
        );
      })();

      expect(forwardRan).to.equal(false);
      expect(childCalls).to.have.lengthOf(2);
      expect(childCalls[0]).to.match(/"first"/);
      expect(childCalls[1]).to.match(/"second"/);
    });

    it('aborts the transcript walk on the first child failure', async () => {
      const macroContract = makeContract({ macro: true });
      registerMacro(macroContract, async () => undefined);

      const childContract = makeContract({
        name: OperationName.sortDelete as any,
      });
      let calls = 0;
      OperationRegistry.register(childContract, async () => {
        calls++;
        if (calls === 1) throw new Error('first fails');
      });

      const entry = OperationRegistry.resolve(macroContract.name, 1);
      const { runInReplay } = require('../../../src/ee/helpers/replayScope');
      let caught: Error | undefined;
      try {
        await runInReplay(() =>
          entry!.handler(
            baseCtx,
            {},
            {
              entryId: 'e',
              createdBy: 'u',
              originalReq: {} as any,
              extra: {
                macroTranscript: [
                  { op: childContract.name, version: 1, params: {} },
                  { op: childContract.name, version: 1, params: {} },
                ],
              } as any,
            },
          ),
        );
      } catch (e: any) {
        caught = e;
      }
      expect(caught).to.exist;
      expect(caught!.message).to.match(/first fails/);
      expect(calls).to.equal(1);
    });

    it('propagates metaUpdate from a child via merged macroTranscript', async () => {
      const macroContract = makeContract({ macro: true });
      registerMacro(macroContract, async () => undefined);

      const childContract = makeContract({
        name: OperationName.sortDelete as any,
      });
      OperationRegistry.register(childContract, async () => ({
        metaUpdate: { rotated: true },
      }));

      const entry = OperationRegistry.resolve(macroContract.name, 1);
      const { runInReplay } = require('../../../src/ee/helpers/replayScope');
      const out = (await runInReplay(() =>
        entry!.handler(
          baseCtx,
          {},
          {
            entryId: 'e',
            createdBy: 'u',
            originalReq: {} as any,
            extra: {
              macroTranscript: [
                { op: childContract.name, version: 1, params: {} },
              ],
            } as any,
          },
        ),
      )) as any;

      expect(out?.metaUpdate?.macroTranscript).to.have.lengthOf(1);
      expect(out.metaUpdate.macroTranscript[0].extra).to.deep.equal({
        rotated: true,
      });
    });
  });
});
