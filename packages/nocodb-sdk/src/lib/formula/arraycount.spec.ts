import { validateFormulaAndExtractTreeWithType } from './validate-extract-tree';
import { FormulaDataTypes } from './enums';
import UITypes from '../UITypes';
import { SqlUiFactory } from '../sqlUi';
import { UnifiedMetaType } from '~/lib/types';

const col = (
  model: string,
  id: string,
  title: string,
  uidt: UITypes,
  extra: Partial<UnifiedMetaType.IColumn> = {}
): UnifiedMetaType.IColumn => ({
  id,
  title,
  column_name: title.toLowerCase(),
  uidt,
  base_id: 'base1',
  fk_workspace_id: 'ws1',
  fk_model_id: model,
  ...extra,
});

const tables: Record<string, UnifiedMetaType.IColumn[]> = {
  projects: [
    col('projects', 'p_name', 'Name', UITypes.SingleLineText, { pv: true }),
    col('projects', 'p_budget', 'Budget', UITypes.Number),
    col('projects', 'p_tags', 'Tags', UITypes.MultiSelect),
    col('projects', 'p_owners', 'Owners', UITypes.User),
    col('projects', 'p_status', 'Status', UITypes.SingleSelect),
    col('projects', 'p_tasks', 'Tasks', UITypes.LinkToAnotherRecord, {
      colOptions: {
        id: 'p_tasks_opt',
        fk_column_id: 'p_tasks',
        fk_related_model_id: 'tasks',
        type: 'hm',
      } as UnifiedMetaType.ILinkToAnotherRecordColumn,
    }),
  ],
  tasks: [
    col('tasks', 't_title', 'Title', UITypes.SingleLineText, { pv: true }),
  ],
};

const getMeta: UnifiedMetaType.IGetModel = async (_ctx, { id }) => ({
  id,
  title: id,
  base_id: 'base1',
  columns: tables[id],
});

const validate = (formula: string, client = 'pg') =>
  validateFormulaAndExtractTreeWithType({
    formula,
    columns: tables.projects,
    clientOrSqlUi: SqlUiFactory.create({ client }),
    getMeta,
  });

describe('ARRAYCOUNT', () => {
  describe.each(['pg', 'mysql2', 'sqlite3', 'mssql', 'oracledb'])(
    'on %s',
    (client) => {
      it.each(['ARRAYCOUNT({Tags})', 'ARRAYCOUNT({Owners})'])(
        'accepts %s as a number',
        async (formula) => {
          const result = await validate(formula, client);
          expect(result.dataType).toBe(FormulaDataTypes.NUMERIC);
        }
      );

      it.each([
        'ARRAYCOUNT({Name})',
        'ARRAYCOUNT({Status})',
        'ARRAYCOUNT({Budget})',
        'ARRAYCOUNT("a,b")',
      ])('rejects %s', async (formula) => {
        await expect(validate(formula, client)).rejects.toHaveProperty(
          'extra.key',
          'msg.formula.firstParamMultiValueOrArray'
        );
      });

      it('requires exactly one argument', async () => {
        await expect(
          validate('ARRAYCOUNT({Tags}, {Tags})', client)
        ).rejects.toBeTruthy();
      });
    }
  );

  it.each([
    'ARRAYCOUNT({Tasks})',
    'ARRAYCOUNT({Tasks}.{Title})',
    'ARRAYCOUNT(ARRAYUNIQUE({Tasks}))',
    'ARRAYCOUNT(TEXTSPLIT("a,b", ","))',
  ])('accepts the list %s on pg', async (formula) => {
    const result = await validate(formula);
    expect(result.dataType).toBe(FormulaDataTypes.NUMERIC);
  });

  // lists follow the other array functions, which run on pg only
  it.each(['mysql2', 'sqlite3', 'mssql', 'oracledb'])(
    'rejects a list on %s',
    async (client) => {
      await expect(
        validate('ARRAYCOUNT({Tasks})', client)
      ).rejects.toHaveProperty('extra.key', 'msg.formula.listArgUnavailable');
    }
  );
});
