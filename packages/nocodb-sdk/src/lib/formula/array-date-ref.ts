import { FormulaDataTypes, JSEPNode } from '~/lib/formula/enums';
import type { ParsedFormulaNode } from '~/lib/formula/types';

/**
 * Id of the multi-value date field a formula only references, as in
 * `{LkDue}` over a has-many date lookup. Callers filter through that field
 * when it is a Lookup (or a Formula of the same shape): a date condition
 * matches when any of its dates does.
 */
export function getFormulaArrayDateRefColumnId(
  parsedTree?: ParsedFormulaNode | null
): string | undefined {
  if (
    parsedTree?.type === JSEPNode.IDENTIFIER &&
    parsedTree.dataType === FormulaDataTypes.DATE &&
    parsedTree.isDataArray
  ) {
    return parsedTree.name;
  }
  return undefined;
}
