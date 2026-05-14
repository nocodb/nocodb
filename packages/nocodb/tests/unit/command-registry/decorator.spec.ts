import { expect } from 'chai';
import { z } from 'zod';
import {
  TraceCommand,
  Untraced,
  captureForTrace,
  getTraceCapture,
  isTraceActive,
  runInChildTraceScope,
  runUntraced,
} from '~/decorators/trace-command.decorator';
import { OperationRegistry } from '~/command-registry/registry';
import type {
  OperationContract,
} from '~/command-registry/types';
import { MetaTable } from '~/utils/globals';
import { OperationName } from '~/command-registry/op-names';
import { scopeBase } from '~/command-registry/scope';

function makeContract(
  name: OperationName,
  opts: {
    macro?: boolean;
    capture?: Array<'filters'>;
    before?: () => Promise<any>;
    skip_if?: () => boolean;
  } = {},
): OperationContract {
  return {
    name,
    version: 1,
    entity: MetaTable.MODELS,
    schema: z.object({ id: z.string().optional() }).strict(),
    macro: opts.macro,
    capture: opts.capture,
    entry: {
      entity_id: (_p: any, r: any) => r?.id,
      before: opts.before,
      skip_if: opts.skip_if as any,
    },
  } as OperationContract;
}

function resetRegistry() {
  (OperationRegistry as any).entries.clear();
  (OperationRegistry as any).frozen = false;
}

describe('@TraceCommand decorator', () => {
  beforeEach(resetRegistry);
  // Clear the singleton on exit so the next test file (which may boot
  // Nest → OperationRegistryBootstrap registers the real contracts) doesn't
  // hit "Duplicate handler" on names this suite poked at.
  after(resetRegistry);

  describe('captureForTrace / getTraceCapture / isTraceActive', () => {
    it('no-op outside any trace scope', () => {
      expect(isTraceActive()).to.equal(false);
      captureForTrace('filters', [{ a: 1 }]);
      expect(getTraceCapture('filters')).to.be.undefined;
    });

    it('round-trips inside runInChildTraceScope', async () => {
      const { bag } = await runInChildTraceScope(async () => {
        expect(isTraceActive()).to.equal(true);
        captureForTrace('filters', [{ k: 1 }]);
        expect(getTraceCapture('filters')).to.deep.equal([{ k: 1 }]);
      });
      expect(bag.get('filters')).to.deep.equal([{ k: 1 }]);
    });

    it('isTraceActive returns false again after scope resolves', async () => {
      await runInChildTraceScope(async () => {
        /* noop */
      });
      expect(isTraceActive()).to.equal(false);
    });
  });

  describe('runUntraced / @Untraced', () => {
    it('runUntraced opens an active scope so nested traced calls re-enter', async () => {
      const contract = makeContract(OperationName.sortCreate);
      OperationRegistry.register(contract, async () => ({ id: 's1' }));

      class Svc {
        @TraceCommand(OperationName.sortCreate)
        async create(_ctx: any, _p: any) {
          expect(isTraceActive()).to.equal(true);
          return { id: 's1', ran: true };
        }
      }

      const svc = new Svc();
      const result = await runUntraced(() => svc.create({ base_id: 'b' }, {}));
      expect(result).to.deep.equal({ id: 's1', ran: true });
    });

    it('@Untraced wraps the body in runUntraced', async () => {
      class Svc {
        @Untraced()
        async bulkCreate(_ctx: any) {
          expect(isTraceActive()).to.equal(true);
          return 'ok';
        }
      }

      const out = await new Svc().bulkCreate({});
      expect(out).to.equal('ok');
      expect(isTraceActive()).to.equal(false);
    });
  });

  describe('runInChildTraceScope', () => {
    it('isolates child captures from outer scope', async () => {
      await runInChildTraceScope(async () => {
        captureForTrace('filters', [{ outer: 1 }]);
        const { bag } = await runInChildTraceScope(async () => {
          expect(getTraceCapture('filters')).to.be.undefined;
          captureForTrace('filters', [{ inner: 2 }]);
        });
        expect(getTraceCapture('filters')).to.deep.equal([{ outer: 1 }]);
        expect(bag.get('filters')).to.deep.equal([{ inner: 2 }]);
      });
    });

    it('returns inner function result alongside the bag', async () => {
      const { result, bag } = await runInChildTraceScope(async () => 'hello');
      expect(result).to.equal('hello');
      expect(bag.size).to.equal(0);
    });
  });

  describe('outermost trace flow', () => {
    it('opens a fresh scope, runs entry.before, then runs the method body', async () => {
      const beforeFired: string[] = [];
      const contract = makeContract(OperationName.sortCreate, {
        before: async () => {
          beforeFired.push('before');
          return { entityTitle: 't' };
        },
      });
      OperationRegistry.register(contract, async () => undefined);

      class Svc {
        @TraceCommand(OperationName.sortCreate)
        async create(_ctx: any, _p: any) {
          return { id: 's1' };
        }
      }

      const r = await new Svc().create({} as any, {});
      expect(r).to.deep.equal({ id: 's1' });
      expect(beforeFired).to.deep.equal(['before']);
    });

    it('OperationNameResolver: returning undefined skips tracing entirely', async () => {
      let bodyRan = false;
      let activeInside = true;
      class Svc {
        @TraceCommand((() => undefined) as any)
        async maybe(_ctx: any) {
          bodyRan = true;
          activeInside = isTraceActive();
          return 'plain';
        }
      }

      const r = await new Svc().maybe({});
      expect(r).to.equal('plain');
      expect(bodyRan).to.equal(true);
      expect(activeInside).to.equal(false);
    });

    it('OperationNameResolver: returning a registered name opens trace', async () => {
      const contract = makeContract(OperationName.sortCreate);
      OperationRegistry.register(contract, async () => undefined);

      let activeInside = false;
      class Svc {
        @TraceCommand((() => OperationName.sortCreate) as any)
        async create(_ctx: any) {
          activeInside = isTraceActive();
          return { id: 's1' };
        }
      }

      await new Svc().create({});
      expect(activeInside).to.equal(true);
    });

    it('contract not found in registry: falls back to plain method call', async () => {
      let active = false;
      class Svc {
        @TraceCommand(OperationName.sortDelete)
        async del(_ctx: any) {
          active = isTraceActive();
          return 'ok';
        }
      }

      const out = await new Svc().del({});
      expect(out).to.equal('ok');
      expect(active).to.equal(false);
    });

    it('re-entrant non-macro: inner call does NOT open a fresh scope', async () => {
      const outerContract = makeContract(OperationName.sortCreate);
      const innerContract = makeContract(OperationName.sortUpdate);
      OperationRegistry.register(outerContract, async () => undefined);
      OperationRegistry.register(innerContract, async () => undefined);

      let innerSawActive = false;
      class Svc {
        @TraceCommand(OperationName.sortCreate)
        async outer(ctx: any) {
          captureForTrace('filters', [{ outer: 1 }]);
          await this.inner(ctx);
          return 'ok';
        }

        @TraceCommand(OperationName.sortUpdate)
        async inner(_ctx: any) {
          innerSawActive = isTraceActive();
          expect(getTraceCapture('filters')).to.deep.equal([{ outer: 1 }]);
          return 'inner-ok';
        }
      }

      const out = await new Svc().outer({});
      expect(out).to.equal('ok');
      expect(innerSawActive).to.equal(true);
    });
  });

  describe('entry.before and entry.skip_if failure tolerance', () => {
    it('entry.before throwing propagates and prevents the call', async () => {
      const contract = makeContract(OperationName.sortCreate, {
        before: async () => {
          throw new Error('snapshot failed');
        },
      });
      OperationRegistry.register(contract, async () => undefined);

      let bodyRan = false;
      class Svc {
        @TraceCommand(OperationName.sortCreate)
        async create(_ctx: any) {
          bodyRan = true;
          return { id: 'ok' };
        }
      }

      let caught: Error | undefined;
      try {
        await new Svc().create({});
      } catch (e: any) {
        caught = e;
      }
      expect(caught?.message).to.equal('snapshot failed');
      expect(bodyRan).to.equal(false);
    });

    it('entry.skip_if returning true does not crash the call', async () => {
      const contract = makeContract(OperationName.sortCreate, {
        skip_if: () => true,
      });
      OperationRegistry.register(contract, async () => undefined);

      class Svc {
        @TraceCommand(OperationName.sortCreate)
        async create(_ctx: any) {
          return { id: 'sk' };
        }
      }

      const r = await new Svc().create({});
      expect(r).to.deep.equal({ id: 'sk' });
    });
  });

  describe('scope helpers smoke', () => {
    it('scopeBase still works inside a trace scope', async () => {
      await runInChildTraceScope(async () => {
        const ref = scopeBase({ base_id: 'p_test' } as any);
        expect(ref).to.deep.equal({ type: 'base', id: 'p_test' });
      });
    });
  });
});
