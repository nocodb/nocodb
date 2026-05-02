import { expect } from 'chai';
import { z } from 'zod';
import { OperationRegistry } from '../../../src/ee/command-registry/registry';
import type {
  OperationContract,
  CommandHandler,
} from '../../../src/ee/command-registry/types';
import { MetaTable } from '../../../src/utils/globals';

describe('OperationRegistry', () => {
  // Tests use a fresh module import to avoid cross-test contamination.
  // ts-mocha re-imports per file, but the singleton persists. Each test
  // resets via the (private) clear() helper added below for tests only.
  beforeEach(() => {
    (OperationRegistry as any).entries.clear();
    (OperationRegistry as any).frozen = false;
  });

  const FooV1 = {
    name: 'foo',
    version: 1,
    entity: MetaTable.MODELS,
    schema: z.object({ id: z.string() }),
  } as const satisfies OperationContract;

  const handler: CommandHandler<typeof FooV1> = async () => ({ ok: true });

  it('registers a contract + handler under name@version', () => {
    OperationRegistry.register(FooV1, handler);
    const found = OperationRegistry.resolve('foo', 1);
    expect(found).to.exist;
    expect(found!.contract).to.equal(FooV1);
  });

  it('throws on duplicate name@version', () => {
    OperationRegistry.register(FooV1, handler);
    expect(() => OperationRegistry.register(FooV1, handler)).to.throw(
      /Duplicate handler/,
    );
  });

  it('throws when registering after freeze()', () => {
    OperationRegistry.freeze();
    expect(() => OperationRegistry.register(FooV1, handler)).to.throw(
      /frozen/,
    );
  });

  it('resolve() returns undefined for unknown ops', () => {
    expect(OperationRegistry.resolve('unknown', 1)).to.be.undefined;
  });

  it('describe() returns sorted entries with schemaHash', () => {
    const BarV1 = {
      ...FooV1,
      name: 'bar',
    } as const satisfies OperationContract;
    OperationRegistry.register(BarV1, handler);
    OperationRegistry.register(FooV1, handler);
    const list = OperationRegistry.describe();
    expect(list.map((e) => e.name)).to.deep.equal(['bar', 'foo']);
    for (const e of list) {
      expect(e.schemaHash).to.be.a('string').and.have.lengthOf(12);
    }
  });

  it('two contracts with different schemas have different schemaHash', () => {
    const FooV2 = {
      ...FooV1,
      name: 'foo2',
      schema: z.object({ id: z.string(), extra: z.number() }),
    } as const satisfies OperationContract;
    OperationRegistry.register(FooV1, handler);
    OperationRegistry.register(FooV2, handler);
    const list = OperationRegistry.describe();
    const hashFoo = list.find((e) => e.name === 'foo')!.schemaHash;
    const hashFoo2 = list.find((e) => e.name === 'foo2')!.schemaHash;
    expect(hashFoo).to.not.equal(hashFoo2);
  });
});
