import { hoistInterfaceTableVizFilters } from './index';
import type { InterfaceFilterGroup, InterfaceFilterLeaf } from './elements';

const leaf = (id: string, logical_op?: 'and' | 'or'): InterfaceFilterLeaf => ({
  fk_column_id: id,
  comparison_op: 'eq',
  value: id,
  ...(logical_op ? { logical_op } : {}),
});

const group = (
  children: InterfaceFilterGroup['children']
): InterfaceFilterGroup => ({ is_group: true, logical_op: 'and', children });

type TableConfig = {
  filters?: InterfaceFilterGroup;
  visualizations: { id: string; filters?: InterfaceFilterGroup }[];
};

const hoist = (config: TableConfig) => hoistInterfaceTableVizFilters(config);

describe('hoistInterfaceTableVizFilters', () => {
  it('nests a viz OR-group as one AND child after the page leaves', () => {
    const orGroup = group([leaf('b'), leaf('c', 'or')]);
    const result = hoist({
      filters: group([leaf('a'), leaf('d', 'and')]),
      visualizations: [{ id: 'v1', filters: orGroup }],
    });

    expect(result.filters).toEqual(
      group([
        { ...leaf('a'), logical_op: 'and' },
        leaf('d', 'and'),
        { ...orGroup, logical_op: 'and' },
      ])
    );
    expect(result.visualizations).toEqual([{ id: 'v1' }]);
  });

  it('splices a single-child viz group and resets its op to and', () => {
    const result = hoist({
      visualizations: [{ id: 'v1', filters: group([leaf('a', 'or')]) }],
    });

    expect(result.filters).toEqual(group([leaf('a', 'and')]));
  });

  it('dedupes the same viz filter on two vizzes', () => {
    const vizFilter = group([leaf('a'), leaf('b', 'or')]);
    const result = hoist({
      visualizations: [
        { id: 'v1', filters: vizFilter },
        { id: 'v2', filters: vizFilter },
      ],
    });

    expect(result.filters?.children).toHaveLength(1);
    expect(result.visualizations).toEqual([{ id: 'v1' }, { id: 'v2' }]);
  });

  it('returns the same object when no viz has a filter', () => {
    const config: TableConfig = {
      filters: group([leaf('a')]),
      visualizations: [{ id: 'v1' }, { id: 'v2', filters: group([]) }],
    };

    expect(hoist(config)).toBe(config);
  });
});
