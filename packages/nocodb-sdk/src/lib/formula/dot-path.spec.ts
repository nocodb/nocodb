import { validateFormulaAndExtractTreeWithType } from './validate-extract-tree';
import { FormulaDataTypes, FormulaErrorType, JSEPNode } from './enums';
import { formulaJsep } from './jsepInstances';
import UITypes from '../UITypes';
import { UnifiedMetaType } from '~/lib/types';
import {
  jsepTreeToFormula,
  substituteColumnAliasWithIdInFormula,
  substituteColumnIdWithAliasInFormula,
} from '../formulaHelpers';

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

const link = (
  model: string,
  id: string,
  title: string,
  related: string,
  type: 'hm' | 'bt' | 'mm'
) =>
  col(model, id, title, UITypes.LinkToAnotherRecord, {
    colOptions: {
      id: `${id}_opt`,
      fk_column_id: id,
      fk_related_model_id: related,
      type,
    } as UnifiedMetaType.ILinkToAnotherRecordColumn,
  });

// Tasks --bt--> Projects --bt--> Clients ; Projects --hm--> Tasks
const tables: Record<string, UnifiedMetaType.IColumn[]> = {
  tasks: [
    col('tasks', 't_title', 'Title', UITypes.SingleLineText, { pv: true }),
    col('tasks', 't_hours', 'Hours', UITypes.Number),
    link('tasks', 't_project', 'Project', 'projects', 'bt'),
  ],
  projects: [
    col('projects', 'p_name', 'Name', UITypes.SingleLineText, { pv: true }),
    col('projects', 'p_budget', 'Budget', UITypes.Currency),
    col('projects', 'p_end', 'End Date', UITypes.Date),
    link('projects', 'p_client', 'Client', 'clients', 'bt'),
    link('projects', 'p_tasks', 'Tasks', 'tasks', 'hm'),
  ],
  clients: [
    col('clients', 'c_name', 'Name', UITypes.SingleLineText, { pv: true }),
    col('clients', 'c_region', 'Region', UITypes.SingleLineText),
  ],
};

const getMeta: UnifiedMetaType.IGetModel = async (_ctx, { id }) => ({
  id,
  title: id,
  base_id: 'base1',
  columns: tables[id],
});

const validate = (formula: string, model = 'tasks') =>
  validateFormulaAndExtractTreeWithType({
    formula,
    columns: tables[model],
    clientOrSqlUi: 'pg',
    getMeta,
  });

describe('dot path parsing', () => {
  it('parses a field path as a member expression', () => {
    const tree: any = formulaJsep('{Project}.{Client}.{Region}');
    expect(tree.type).toBe(JSEPNode.MEMBER_EXP);
    expect(tree.property.name).toBe('Region');
    expect(tree.object.object.name).toBe('Project');
  });

  it('desugars method calls into regular calls', () => {
    const tree: any = formulaJsep('{Tasks}.{Hours}.SUM()');
    expect(tree.type).toBe(JSEPNode.CALL_EXP);
    expect(tree.callee.name).toBe('SUM');
    expect(tree.chained).toBe(true);
    expect(tree.arguments[0].type).toBe(JSEPNode.MEMBER_EXP);
  });

  it.each([
    '{Project}.{Budget}',
    '{Tasks}.{Hours}.SUM()',
    'ROUND({Tasks}.{Hours}.AVG(), 2)',
    'UPPER({Name}).LEN()',
    '(1).ROUND()',
  ])('prints %s back unchanged', (formula) => {
    expect(jsepTreeToFormula(formulaJsep(formula))).toBe(formula);
  });
});

describe('dot path validation', () => {
  it('types a single hop by the target field', async () => {
    const res: any = await validate('{Project}.{Budget}');
    expect(res.dataType).toBe(FormulaDataTypes.NUMERIC);
    expect(res.isDataArray).toBe(false);
    expect(res.object.name).toBe('t_project');
    expect(res.property.name).toBe('p_budget');
    expect(res.referencedColumn).toEqual({
      id: 'p_budget',
      uidt: UITypes.Currency,
    });
  });

  it('follows multiple hops', async () => {
    const res: any = await validate('{Project}.{Client}.{Region}');
    expect(res.dataType).toBe(FormulaDataTypes.STRING);
    expect(res.isDataArray).toBe(false);
    expect(res.property.name).toBe('c_region');
  });

  it('marks paths through a to-many link as lists', async () => {
    const res: any = await validate('{Tasks}.{Hours}', 'projects');
    expect(res.isDataArray).toBe(true);
    expect(res.dataType).toBe(FormulaDataTypes.NUMERIC);

    const back: any = await validate('{Project}.{Tasks}.{Hours}');
    expect(back.isDataArray).toBe(true);
  });

  it('aggregates a list with a chained call', async () => {
    const res: any = await validate('{Tasks}.{Hours}.SUM()', 'projects');
    expect(res.type).toBe(JSEPNode.CALL_EXP);
    expect(res.dataType).toBe(FormulaDataTypes.NUMERIC);
    expect(res.isDataArray).toBeFalsy();
  });

  it('rejects a hop through a non-link field', async () => {
    await expect(validate('{Hours}.{Budget}')).rejects.toMatchObject({
      type: FormulaErrorType.INVALID_SYNTAX,
    });
  });

  it('rejects an unknown field in the linked table', async () => {
    await expect(validate('{Project}.{Nope}')).rejects.toMatchObject({
      type: FormulaErrorType.INVALID_COLUMN,
    });
  });

  it('names an unknown method after a field', async () => {
    await expect(validate('{Hours}.SUMX')).rejects.toMatchObject({
      type: FormulaErrorType.INVALID_FUNCTION_NAME,
      message: 'Function SUMX is not available',
    });
  });

  it('asks for parentheses after a known method', async () => {
    await expect(validate('{Hours}.ROUND')).rejects.toMatchObject({
      type: FormulaErrorType.INVALID_SYNTAX,
    });
  });

  it('rejects bare member access', async () => {
    await expect(validate('a.b')).rejects.toMatchObject({
      type: FormulaErrorType.NOT_SUPPORTED,
    });
  });

  it('rejects calling a non-function', async () => {
    await expect(validate('{Project}(1)')).rejects.toMatchObject({
      type: FormulaErrorType.INVALID_SYNTAX,
    });
  });
});

describe('dot path substitution', () => {
  const related = (c) => tables[(c.colOptions as any).fk_related_model_id];

  it('stores each hop by id', async () => {
    const stored = await substituteColumnAliasWithIdInFormula(
      'CONCAT({Project}.{Client}.{Region}, {Title})',
      tables.tasks,
      related
    );
    expect(stored).toBe(
      'CONCAT({{t_project}}.{{p_client}}.{{c_region}}, {{t_title}})'
    );
  });

  it.each([
    ['{Project}.Budget', '{{t_project}}.Budget'],
    ['{Hours}.SUM', '{{t_hours}}.SUM'],
  ])(
    'keeps a name without braces after "." as written: %s',
    async (raw, stored) => {
      const formula = await substituteColumnAliasWithIdInFormula(
        raw,
        tables.tasks,
        related
      );
      expect(formula).toBe(stored);
      await expect(validate(formula)).rejects.toBeTruthy();
    }
  );

  it('asks for parentheses after a stored method name', async () => {
    const formula = await substituteColumnAliasWithIdInFormula(
      '{Hours}.SUM',
      tables.tasks,
      related
    );
    await expect(validate(formula)).rejects.toMatchObject({
      extra: { key: 'msg.formula.formulaMissingParentheses' },
    });
  });

  it.each(['a.b', '{Nope}.SUMX'])(
    'rejects member access on a non-field after storing: %s',
    async (raw) => {
      const formula = await substituteColumnAliasWithIdInFormula(
        raw,
        tables.tasks,
        related
      );
      await expect(validate(formula)).rejects.toMatchObject({
        type: FormulaErrorType.NOT_SUPPORTED,
      });
    }
  );

  it('renders ids back as titles', () => {
    expect(
      substituteColumnIdWithAliasInFormula(
        '{{t_project}}.{{p_end}}',
        tables.tasks,
        undefined,
        related
      )
    ).toBe('{Project}.{End Date}');
  });

  it('falls back to the raw formula when a linked table is unknown', () => {
    expect(
      substituteColumnIdWithAliasInFormula(
        '{{t_project}}.{{p_end}}',
        tables.tasks,
        '{Project}.{Deadline}'
      )
    ).toBe('{Project}.{Deadline}');
  });
});

describe('list aggregates on databases without COUNT', () => {
  const validateOn = (
    formula: string,
    client: 'mysql2' | 'sqlite3' | 'snowflake'
  ) =>
    validateFormulaAndExtractTreeWithType({
      formula,
      columns: tables.projects,
      clientOrSqlUi: client,
      getMeta,
    });

  it('allows COUNTA over a list', async () => {
    const res: any = await validateOn('{Tasks}.{Title}.COUNTA()', 'mysql2');
    expect(res.dataType).toBe(FormulaDataTypes.NUMERIC);
  });

  it('allows COUNTA over plain values where the database has it', async () => {
    const res: any = await validateOn('COUNTA({Name})', 'mysql2');
    expect(res.dataType).toBe(FormulaDataTypes.NUMERIC);
  });

  it('still rejects COUNTA over plain values elsewhere', async () => {
    await expect(validateOn('COUNTA({Name})', 'snowflake')).rejects.toMatchObject({
      type: FormulaErrorType.INVALID_FUNCTION_NAME,
    });
  });
});
