import { formulaJsep } from 'nocodb-sdk';
import type FormulaColumn from '~/models/FormulaColumn';
import type { ButtonColumn } from '~/models';
import { formulaTreeReferencesColumn } from '~/helpers/formulaHelpers';

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
    if (formulaTreeReferencesColumn(pt, [columnId])) {
      virtualColumn.error = virtualColumn.formula.error || '';
      virtualColumn.error += `Column '${title || columnId}' was deleted`;
      modified = true;
    }
  };
  try {
    fn(formulaJsep(formula.formula), formula);
  } catch (e) {
    // handle any parsing error as well
    formula.error = e.message;
    modified = true;
  }
  return modified;
}
