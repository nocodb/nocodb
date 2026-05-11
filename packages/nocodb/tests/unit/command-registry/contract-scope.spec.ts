import { expect } from 'chai';
import type { NcContext } from '../../../src/interface/config';
import type { OperationContract, ScopeRef } from '../../../src/command-registry/types';
import { SortCreateContract } from '../../../src/ee/command-registry/operations/sorts';

/**
 * Per-contract scope assertion. Each iter migrates a batch of contracts;
 * this spec accumulates one expectation per contract so a regression
 * (e.g. someone deletes `scope` or changes the resolver) surfaces here.
 *
 * `params` is the validated body the contract would receive. Tests don't
 * exercise schema.parse — they pin the resolver's behavior against a
 * representative shape.
 */
function expectScope<S extends OperationContract<any>>(
  contract: S,
  params: any,
  expected: ScopeRef,
  result: any = {},
  resolvedCtx: any = undefined,
  context: NcContext = { base_id: 'p_test' } as NcContext,
) {
  expect(
    contract.undo?.scope,
    `${contract.name} missing undo.scope`,
  ).to.be.a('function');
  const got = contract.undo!.scope!(params, result, resolvedCtx, context);
  expect(got).to.deep.equal(expected);
}

describe('contract scope resolvers', () => {
  describe('sorts (iter 3 smoke)', () => {
    it('sortCreate → VIEW(viewId)', () => {
      expectScope(
        SortCreateContract,
        { viewId: 'vw_abc', sort: { fk_column_id: 'col_x', direction: 'asc' } },
        { type: 'view', id: 'vw_abc' },
      );
    });
  });
});
