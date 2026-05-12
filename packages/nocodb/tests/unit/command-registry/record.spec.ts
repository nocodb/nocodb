import { expect } from 'chai';
import {
  extractReplayableParams,
  resolveField,
  dotGet,
} from '~/command-registry/record';

describe('_record helpers', () => {
  describe('extractReplayableParams', () => {
    it('strips req, ncMeta, user, reuse, viewWebhookManager, columnWebhookManager', () => {
      const result = extractReplayableParams({
        baseId: 'base1',
        variable: { key: 'X' },
        req: { user: { id: 'u1' } },
        ncMeta: {} as any,
        user: { id: 'u1' },
        reuse: {},
        viewWebhookManager: {},
        columnWebhookManager: {},
      });
      expect(result).to.deep.equal({
        baseId: 'base1',
        variable: { key: 'X' },
      });
    });

    it('returns {} for non-object', () => {
      expect(extractReplayableParams(null)).to.deep.equal({});
      expect(extractReplayableParams(undefined)).to.deep.equal({});
      expect(extractReplayableParams('string')).to.deep.equal({});
    });
  });

  describe('dotGet', () => {
    it('reads nested path', () => {
      expect(dotGet({ a: { b: { c: 1 } } }, 'a.b.c')).to.equal(1);
    });
    it('returns undefined for missing path', () => {
      expect(dotGet({ a: 1 }, 'a.b.c')).to.be.undefined;
    });
    it('handles null in chain', () => {
      expect(dotGet({ a: null }, 'a.b')).to.be.undefined;
    });
  });

  describe('resolveField', () => {
    it('reads dot-path, result first then param', () => {
      expect(
        resolveField('id', { id: 'p' }, { id: 'r' }),
      ).to.equal('r');
    });
    it('falls back to param when result missing', () => {
      expect(resolveField('id', { id: 'p' }, undefined)).to.equal('p');
    });
    it('calls function when given a function', () => {
      const fn = (p: any, r: any) => `${p.x}-${r?.y ?? 'no'}`;
      expect(resolveField(fn, { x: 1 }, { y: 2 })).to.equal('1-2');
    });
    it('returns undefined for undefined field', () => {
      expect(resolveField(undefined, {}, {})).to.be.undefined;
    });
  });
});
