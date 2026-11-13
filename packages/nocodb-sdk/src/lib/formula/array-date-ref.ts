import { FormulaDataTypes, JSEPNode } from '~/lib/formula/enums';
import type { ParsedFormulaNode } from '~/lib/formula/types';

/**
 * Id of the multi-value date field (e.g. a has-many date lookup) a formula
 * only references, as in `{LkDue}`. Such a formula filters like that field:
 * a date condition matches when any of its dates does.
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
