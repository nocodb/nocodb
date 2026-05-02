import { expect } from 'chai';
import type { SandboxChangelog } from '~/models';
import { expandSelectedEntries } from '~/ee/helpers/sandboxCherryPick';
import { MetaTable } from '~/utils/globals';

function mkEntry(
  id: string,
  event: string,
  entityId: string,
  parentId: string | undefined,
  deps: Array<{ entity: string; id: string }> = [],
): SandboxChangelog {
  return {
    id,
    event,
    entity_id: entityId,
    parent_entity_id: parentId,
    meta: JSON.stringify({
      command: { operation: event, params: {} },
      ...(deps.length ? { deps } : {}),
    }),
  } as any;
}

describe('expandSelectedEntries with meta.deps', () => {
  it('includes referential deps transitively', () => {
    const entries = [
      mkEntry('e1', 'tableCreate', 'tbl_A', undefined),
      mkEntry('e2', 'columnAdd', 'col_a1', 'tbl_A'),
      mkEntry('e3', 'columnAdd', 'col_a2', 'tbl_A'),
      mkEntry('e4', 'columnAdd', 'col_formula', 'tbl_A', [
        { entity: MetaTable.COLUMNS, id: 'col_a1' },
      ]),
    ];
    const result = expandSelectedEntries(entries, new Set(['e4']));
    expect([...result].sort()).to.deep.equal(['e1', 'e2', 'e4']);
  });
});
