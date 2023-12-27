import jsep from 'jsep';
import { UITypes } from 'nocodb-sdk';
import type FormulaColumn from '../models/FormulaColumn';
import type { Column } from '~/models';

export async function getFormulasReferredTheColumn({
  column,
  columns,
}: {
  column: Column;
  columns: Column[];
}): Promise<Column[]> {
  const fn = (pt) => {
    if (pt.type === 'CallExpression') {
      return pt.arguments.some((arg) => fn(arg));
    } else if (pt.type === 'Literal') {
    } else if (pt.type === 'Identifier') {
      return [column.id, column.title].includes(pt.name);
    } else if (pt.type === 'BinaryExpression') {
      return fn(pt.left) || fn(pt.right);
    }
  };

  return columns.reduce(async (columnsPromise, c) => {
    const columns = await columnsPromise;
    if (c.uidt !== UITypes.Formula) return columns;

    const formula = await c.getColOptions<FormulaColumn>();

    if (fn(jsep(formula.formula))) {
      columns.push(c);
    }
    return columns;
  }, Promise.resolve([]));
}
