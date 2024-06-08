import jsep from 'jsep';
import { UITypes } from 'nocodb-sdk';
import type FormulaColumn from '../models/FormulaColumn';
import type { Column } from '~/models';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';

export async function getFormulasReferredTheColumn(
  context: NcContext,
  {
    column,
    columns,
  }: {
    column: Column;
    columns: Column[];
  },
  ncMeta = Noco.ncMeta,
): Promise<Column[]> {
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

    const formula = await c.getColOptions<FormulaColumn>(context, ncMeta);

    if (fn(jsep(formula.formula))) {
      columns.push(c);
    }
    return columns;
  }, Promise.resolve([]));
}
