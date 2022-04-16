import jsep from 'jsep';
import jsepTreeToFormula from '../../common/helpers/jsepTreeToFormula';
import Column from '../../../noco-models/Column';

export async function substituteColumnAliasWithIdInFormula(
  formula,
  columns: Column[]
) {
  const substituteId = async (pt: any) => {
    if (pt.type === 'CallExpression') {
      for (const arg of pt.arguments || []) {
        await substituteId(arg);
      }
    } else if (pt.type === 'Literal') {
      return;
    } else if (pt.type === 'Identifier') {
      const colNameOrId = pt.name;
      const column = columns.find(
        c =>
          c.id === colNameOrId ||
          c.column_name === colNameOrId ||
          c.title === colNameOrId
      );
      pt.name = column.id;
    } else if (pt.type === 'BinaryExpression') {
      await substituteId(pt.left);
      await substituteId(pt.right);
    }
  };

  const parsedFormula = jsep(formula);
  await substituteId(parsedFormula);
  return jsepTreeToFormula(parsedFormula);
}

export function substituteColumnIdWithAliasInFormula(
  formula,
  columns: Column[]
) {
  const substituteId = (pt: any) => {
    if (pt.type === 'CallExpression') {
      for (const arg of pt.arguments || []) {
        substituteId(arg);
      }
    } else if (pt.type === 'Literal') {
      return;
    } else if (pt.type === 'Identifier') {
      const colNameOrId = pt.name;
      const column = columns.find(
        c =>
          c.id === colNameOrId ||
          c.column_name === colNameOrId ||
          c.title === colNameOrId
      );
      pt.name = column.id;
    } else if (pt.type === 'BinaryExpression') {
      substituteId(pt.left);
      substituteId(pt.right);
    }
  };

  const parsedFormula = jsep(formula);
  substituteId(parsedFormula);
  return jsepTreeToFormula(parsedFormula);
}
