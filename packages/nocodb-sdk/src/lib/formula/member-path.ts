import { ColumnType } from '~/lib/Api';
import { isBtLikeV2Junction, isLinksOrLTAR, isMMOrMMLike } from '~/lib/UITypes';
import { isCurlyIdentifier } from '~/lib/formula/hooks';

// Given a single list argument (`{Tasks}.{Hours}.SUM()`), these compile to a
// plain SQL aggregate over the linked records, on every database
export const LIST_AGGREGATE_FUNCTIONS = [
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'COUNT',
  'COUNTA',
  'COUNTALL',
];

// Link hops allowed in one dot path, e.g. `{A}.{B}.{C}.{D}.{E}` is 4 hops
export const MAX_DOT_PATH_HOPS = 4;

/**
 * Flattens `{A}.{B}.{C}` into its field references, in order.
 * Returns null when the node is not a pure chain of `{field}` references.
 */
export function getMemberPath(node: any): any[] | null {
  const path = [];
  let current = node;
  while (current?.type === 'MemberExpression') {
    if (current.computed || !isCurlyIdentifier(current.property)) return null;
    path.unshift(current.property);
    current = current.object;
  }
  if (current?.type !== 'Identifier' || !path.length) return null;
  path.unshift(current);
  return path;
}

/** Rebuilds a member chain from field references */
export function buildMemberPath(path: any[]): any {
  return path.slice(1).reduce(
    (object, property) => ({
      type: 'MemberExpression',
      computed: false,
      object,
      property,
    }),
    path[0]
  );
}

// Title before column_name: a renamed field keeps its old column_name, which
// must not shadow a newer field that took over the title.
export const findColumnByRef = <T extends ColumnType>(
  columns: T[] | undefined,
  ref: string
) =>
  columns?.find((c) => c.id === ref) ||
  columns?.find((c) => c.title === ref) ||
  columns?.find((c) => c.column_name === ref);

/** Whether following this link can yield more than one record */
export function isLinkToMany(
  column: ColumnType,
  colOptions: { type?: string }
): boolean {
  const colWithOptions = { ...column, colOptions } as ColumnType;
  // V2 MO/OO use junction tables (isMMOrMMLike=true) but return single records
  const relationType = isBtLikeV2Junction(colWithOptions)
    ? colOptions.type
    : isMMOrMMLike(colWithOptions)
    ? 'mm'
    : colOptions.type;
  return ['hm', 'mm', 'om'].includes(relationType);
}

export const canBeDotPathHop = (column: ColumnType) =>
  !!column && isLinksOrLTAR(column);
