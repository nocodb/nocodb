import jsep from 'jsep';
import type FormulaColumn from '~/models/FormulaColumn';
import type { ButtonColumn } from '~/models';

export default function addFormulaErrorIfMissingColumn({
  formula,
  columnId,
  title,
}: {
  formula: FormulaColumn | ButtonColumn;
  columnId: string;
  title?: string;
}): void | boolean {
  let modified = false;

  const fn = (pt, virtualColumn) => {
    if (pt.type === 'CallExpression') {
      pt.arguments.map((arg) => fn(arg, virtualColumn));
    } else if (pt.type === 'Literal') {
    } else if (pt.type === 'Identifier') {
      if (pt.name === columnId) {
        virtualColumn.error = virtualColumn.formula.error || '';
        virtualColumn.error += `Column '${title || columnId}' was deleted`;
        modified = true;
      }
    } else if (pt.type === 'BinaryExpression') {
      fn(pt.left, virtualColumn);
      fn(pt.right, virtualColumn);
    }
  };
  try {
    fn(jsep(formula.formula), formula);
  } catch (e) {
    // handle any parsing error as well
    formula.error = e.message;
    modified = true;
  }
  return modified;
}
