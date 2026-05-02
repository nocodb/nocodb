import { expect } from 'chai';
import { extractFormulaColumnRefs } from '~/ee/helpers/formulaDeps';

describe('extractFormulaColumnRefs', () => {
  it('returns column IDs from parsed formula tree', () => {
    const parsed = {
      type: 'call',
      name: 'CONCAT',
      arguments: [
        { type: 'column', fk_column_id: 'col_a' },
        { type: 'column', fk_column_id: 'col_b' },
      ],
    };
    expect(extractFormulaColumnRefs(parsed).sort()).to.deep.equal([
      'col_a',
      'col_b',
    ]);
  });

  it('deduplicates repeated refs', () => {
    const parsed = {
      type: 'binop',
      operator: '+',
      left: { type: 'column', fk_column_id: 'col_x' },
      right: { type: 'column', fk_column_id: 'col_x' },
    };
    expect(extractFormulaColumnRefs(parsed)).to.deep.equal(['col_x']);
  });

  it('returns empty array for null/undefined input', () => {
    expect(extractFormulaColumnRefs(null)).to.deep.equal([]);
    expect(extractFormulaColumnRefs(undefined)).to.deep.equal([]);
  });

  it('accepts a formula string by reading parsed_tree adjacent', () => {
    // When called with the column row, reads parsed_tree field
    const col = {
      parsed_tree: { type: 'column', fk_column_id: 'col_y' },
    };
    expect(extractFormulaColumnRefs(col.parsed_tree)).to.deep.equal(['col_y']);
  });

  it('handles unop nodes via operand', () => {
    const parsed = {
      type: 'unop',
      operator: '-',
      operand: { type: 'column', fk_column_id: 'col_u' },
    };
    expect(extractFormulaColumnRefs(parsed)).to.deep.equal(['col_u']);
  });

  it('terminates on cyclic node references', () => {
    const node: any = { type: 'call', name: 'FN', arguments: [] };
    node.self = node; // cycle
    node.arguments.push({ type: 'column', fk_column_id: 'col_c' });
    expect(extractFormulaColumnRefs(node)).to.deep.equal(['col_c']);
  });
});
