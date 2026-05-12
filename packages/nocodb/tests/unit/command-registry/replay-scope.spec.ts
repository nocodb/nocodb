import { expect } from 'chai';
import {
  getReplay,
  isReplay,
  runInReplay,
  setReplay,
} from '~/helpers/replayScope';

describe('replayScope', () => {
  describe('isReplay', () => {
    it('returns false outside runInReplay', () => {
      expect(isReplay()).to.equal(false);
    });

    it('returns true inside runInReplay', async () => {
      await runInReplay(async () => {
        expect(isReplay()).to.equal(true);
      });
    });

    it('returns false again after runInReplay resolves', async () => {
      await runInReplay(async () => {
        /* noop */
      });
      expect(isReplay()).to.equal(false);
    });
  });

  describe('setReplay / getReplay', () => {
    it('round-trips a value inside a scope', async () => {
      await runInReplay(async () => {
        setReplay('sandboxDefaultViewId', 'vw_abc');
        expect(getReplay('sandboxDefaultViewId')).to.equal('vw_abc');
      });
    });

    it('returns undefined for unset keys', async () => {
      await runInReplay(async () => {
        expect(getReplay('sandboxDefaultViewId')).to.be.undefined;
      });
    });

    it('returns undefined outside a scope (no-op write)', () => {
      setReplay('sandboxDefaultViewId', 'vw_xyz');
      expect(getReplay('sandboxDefaultViewId')).to.be.undefined;
    });

    it('stores typed-bag values (sandboxColumnIds record)', async () => {
      await runInReplay(async () => {
        const map = { id: 'col_1', name: 'col_2' };
        setReplay('sandboxColumnIds', map);
        expect(getReplay('sandboxColumnIds')).to.deep.equal(map);
      });
    });

    it('stores typed-bag values (rowColorFilterIds array)', async () => {
      await runInReplay(async () => {
        const ids = ['f1', 'f2', 'f3'] as const;
        setReplay('rowColorFilterIds', ids);
        expect(getReplay('rowColorFilterIds')).to.deep.equal(ids);
      });
    });

    it('overwrites prior value when set twice', async () => {
      await runInReplay(async () => {
        setReplay('sandboxDefaultViewId', 'v1');
        setReplay('sandboxDefaultViewId', 'v2');
        expect(getReplay('sandboxDefaultViewId')).to.equal('v2');
      });
    });
  });

  describe('nested scopes', () => {
    it('inner runInReplay opens an isolated bag — outer values invisible inside', async () => {
      await runInReplay(async () => {
        setReplay('sandboxDefaultViewId', 'outer');
        await runInReplay(async () => {
          expect(getReplay('sandboxDefaultViewId')).to.be.undefined;
        });
      });
    });

    it('inner writes do not leak back to outer', async () => {
      await runInReplay(async () => {
        setReplay('sandboxDefaultViewId', 'outer');
        await runInReplay(async () => {
          setReplay('sandboxDefaultViewId', 'inner');
        });
        expect(getReplay('sandboxDefaultViewId')).to.equal('outer');
      });
    });

    it('isReplay stays true across nested boundaries', async () => {
      await runInReplay(async () => {
        expect(isReplay()).to.equal(true);
        await runInReplay(async () => {
          expect(isReplay()).to.equal(true);
        });
        expect(isReplay()).to.equal(true);
      });
    });
  });

  describe('async isolation', () => {
    it('parallel runInReplay calls do not share bags', async () => {
      const seen: Array<string | undefined> = [];
      await Promise.all([
        runInReplay(async () => {
          setReplay('sandboxDefaultViewId', 'a');
          await new Promise((r) => setTimeout(r, 5));
          seen.push(getReplay('sandboxDefaultViewId'));
        }),
        runInReplay(async () => {
          setReplay('sandboxDefaultViewId', 'b');
          await new Promise((r) => setTimeout(r, 5));
          seen.push(getReplay('sandboxDefaultViewId'));
        }),
      ]);
      expect(seen.sort()).to.deep.equal(['a', 'b']);
    });

    it('runInReplay propagates the inner fn return value', async () => {
      const out = await runInReplay(async () => 42);
      expect(out).to.equal(42);
    });

    it('runInReplay propagates thrown errors', async () => {
      let caught: Error | undefined;
      try {
        await runInReplay(async () => {
          throw new Error('boom');
        });
      } catch (e: any) {
        caught = e;
      }
      expect(caught?.message).to.equal('boom');
      expect(isReplay()).to.equal(false);
    });
  });
});
