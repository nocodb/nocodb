import { validateFormulaAndExtractTreeWithType } from './validate-extract-tree';
import { FormulaDataTypes } from './enums';
import { getMethodFunctions } from './method-scope';
import UITypes from '../UITypes';
import { SqlUiFactory } from '~/lib/sqlUi';
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

// Projects has one value of every type, and many Tasks with the same types
const tables: Record<string, UnifiedMetaType.IColumn[]> = {
  projects: [
    col('projects', 'p_name', 'Name', UITypes.SingleLineText, { pv: true }),
    col('projects', 'p_budget', 'Budget', UITypes.Number),
    col('projects', 'p_end', 'End', UITypes.Date),
    col('projects', 'p_done', 'Done', UITypes.Checkbox, { dt: 'boolean' }),
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
    col('tasks', 't_hours', 'Hours', UITypes.Number),
    col('tasks', 't_due', 'Due', UITypes.Date),
    col('tasks', 't_done', 'Done', UITypes.Checkbox, { dt: 'boolean' }),
  ],
};

const getMeta: UnifiedMetaType.IGetModel = async (_ctx, { id }) => ({
  id,
  title: id,
  base_id: 'base1',
  columns: tables[id],
});

// arguments after the value, for functions that need more than one
const EXTRA_ARGS: Record<string, string> = {
  MOD: '2',
  POWER: '2',
  LEFT: '2',
  RIGHT: '2',
  MID: '1, 2',
  SUBSTR: '1, 2',
  REPLACE: '"a", "b"',
  SEARCH: '"a"',
  REPEAT: '2',
  REGEX_MATCH: '"a"',
  REGEX_EXTRACT: '"a"',
  REGEX_REPLACE: '"a", "b"',
  DATEADD: '1, "day"',
  DATETIME_DIFF: 'NOW(), "days"',
  DATETIME_FORMAT: '"YYYY"',
  ARRAYSLICE: '1, 2',
};

const scopes: {
  label: string;
  dataType: FormulaDataTypes;
  isList: boolean;
  value: string;
}[] = [
  {
    label: 'number',
    dataType: FormulaDataTypes.NUMERIC,
    isList: false,
    value: '{Budget}',
  },
  {
    label: 'text',
    dataType: FormulaDataTypes.STRING,
    isList: false,
    value: '{Name}',
  },
  {
    label: 'date',
    dataType: FormulaDataTypes.DATE,
    isList: false,
    value: '{End}',
  },
  {
    label: 'checkbox',
    dataType: FormulaDataTypes.BOOLEAN,
    isList: false,
    value: '{Done}',
  },
  {
    label: 'list of numbers',
    dataType: FormulaDataTypes.NUMERIC,
    isList: true,
    value: '{Tasks}.{Hours}',
  },
  {
    label: 'list of text',
    dataType: FormulaDataTypes.STRING,
    isList: true,
    value: '{Tasks}.{Title}',
  },
  {
    label: 'list of dates',
    dataType: FormulaDataTypes.DATE,
    isList: true,
    value: '{Tasks}.{Due}',
  },
];

describe.each(['pg', 'mysql2', 'sqlite3'] as const)(
  'method scope on %s',
  (client) => {
    const unsupported = SqlUiFactory.create({ client }).getUnsupportedFnList();

    describe.each(scopes)('$label', ({ dataType, isList, value }) => {
      const functions = getMethodFunctions(dataType, isList) ?? [];

      it('has a scope', () => {
        expect(functions.length).toBeGreaterThan(0);
      });

      // the menu shows unsupported functions disabled, so only the rest must validate
      it.each(functions)('%s validates after the value', async (fn) => {
        const isListAggregate =
          isList && ['COUNT', 'COUNTA', 'COUNTALL'].includes(fn);
        if (unsupported.includes(fn) && !isListAggregate) return;

        await expect(
          validateFormulaAndExtractTreeWithType({
            formula: `${value}.${fn}(${EXTRA_ARGS[fn] ?? ''})`,
            columns: tables.projects,
            clientOrSqlUi: client,
            getMeta,
          })
        ).resolves.toBeTruthy();
      });
    });
  }
);

describe('method scope typing', () => {
  it('offers no numeric aggregates on a list of text', () => {
    const functions = getMethodFunctions(FormulaDataTypes.STRING, true)!;
    expect(functions).not.toContain('SUM');
    expect(functions).not.toContain('AVG');
    expect(functions).toContain('COUNTA');
  });

  it.each(['{Tasks}.{Title}.SUM()', '{Name}.ROUND()'])(
    'rejects %s, which is out of scope',
    async (formula) => {
      await expect(
        validateFormulaAndExtractTreeWithType({
          formula,
          columns: tables.projects,
          clientOrSqlUi: 'pg',
          getMeta,
        })
      ).rejects.toBeTruthy();
    }
  );

  it('leaves unknown value types unscoped', () => {
    expect(getMethodFunctions(FormulaDataTypes.UNKNOWN, false)).toBeNull();
  });
});
