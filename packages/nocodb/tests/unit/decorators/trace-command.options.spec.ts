import { expect } from 'chai';
import { resolveField, TraceCommand } from '~/ee/decorators/trace-command.decorator';
import { MetaTable } from '~/utils/globals';

describe('resolveField', () => {
  it('returns undefined when field is undefined', () => {
    expect(resolveField(undefined, {}, {})).to.equal(undefined);
  });

  it('resolves dot-path from result first, then param', () => {
    expect(resolveField('id', { id: 'p' }, { id: 'r' })).to.equal('r');
    expect(resolveField('id', { id: 'p' }, {})).to.equal('p');
    expect(resolveField('id', { id: 'p' }, null)).to.equal('p');
  });

  it('supports nested dot-paths', () => {
    expect(resolveField('table.id', { table: { id: 'x' } }, {})).to.equal('x');
  });

  it('invokes a function extractor with (param, result)', () => {
    const fn = (p: any, r: any) => `${p.a}-${r.b}`;
    expect(resolveField(fn, { a: '1' }, { b: '2' })).to.equal('1-2');
  });

  it('returns undefined when path misses in both param and result', () => {
    expect(resolveField('missing.x', {}, {})).to.equal(undefined);
  });
});

describe('TraceCommand with TraceCommandOptions', () => {
  it('accepts an options object with entity + entityId', () => {
    const factory = TraceCommand({
      entity: MetaTable.MODELS,
      entityId: 'id',
    });
    expect(factory).to.be.a('function');
  });

  it('accepts options with function entityId and parentId', () => {
    const factory = TraceCommand({
      entity: MetaTable.COLUMNS,
      entityId: (_p, r) => r?.id,
      parentId: (p) => p?.tableId,
    });
    expect(factory).to.be.a('function');
  });
});

