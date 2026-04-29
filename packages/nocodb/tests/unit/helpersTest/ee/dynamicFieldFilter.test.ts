import 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { replaceDynamicFieldWithValue } from '~/helpers/dynamicFieldHelper';
import type { Filter } from '~/models';
import type { Column } from '~/models';

function makeColumn(overrides: Partial<Column> = {}): Column {
  return {
    id: 'col_default',
    title: 'DefaultCol',
    ...overrides,
  } as Column;
}

function makeFilter(overrides: Partial<Filter> = {}): Filter {
  return {
    id: 'flt_1',
    fk_column_id: 'col_filter',
    comparison_op: 'eq',
    ...overrides,
  } as Filter;
}

export function dynamicFieldFilterTests() {
  describe('replaceDynamicFieldWithValue', () => {
    let readByPkStub: sinon.SinonStub;

    beforeEach(() => {
      readByPkStub = sinon.stub();
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should return conditions unchanged when no fk_value_col_id', async () => {
      const conditions = [
        makeFilter({ value: 'static_value' }),
      ];
      const tableColumns = [makeColumn({ id: 'col_filter' })];

      const replaceWithValue = replaceDynamicFieldWithValue(
        { col_filter: 'row_val' },
        '1',
        tableColumns,
        readByPkStub,
      );

      const result = await replaceWithValue(conditions);

      expect(result).to.have.length(1);
      expect(result[0].value).to.equal('static_value');
      expect(readByPkStub.called).to.be.false;
    });

    it('should replace value with row data for same-table dynamic field', async () => {
      const conditions = [
        makeFilter({
          fk_value_col_id: 'col_value',
          fk_link_col_id: undefined,
        }),
      ];
      const tableColumns = [
        makeColumn({ id: 'col_value', title: 'Price' }),
      ];

      const row = { Price: 42 };

      const replaceWithValue = replaceDynamicFieldWithValue(
        row,
        '1',
        tableColumns,
        readByPkStub,
      );

      const result = await replaceWithValue(conditions);

      expect(result).to.have.length(1);
      expect(result[0].value).to.equal(42);
      expect(readByPkStub.called).to.be.false;
    });

    it('should replace value with null when row field is missing', async () => {
      const conditions = [
        makeFilter({
          fk_value_col_id: 'col_value',
          fk_link_col_id: undefined,
        }),
      ];
      const tableColumns = [
        makeColumn({ id: 'col_value', title: 'MissingField' }),
      ];

      const row = { OtherField: 'abc' };

      const replaceWithValue = replaceDynamicFieldWithValue(
        row,
        '1',
        tableColumns,
        readByPkStub,
      );

      const result = await replaceWithValue(conditions);

      expect(result).to.have.length(1);
      expect(result[0].value).to.be.null;
    });

    it('should fetch row via readByPk when row is null', async () => {
      const conditions = [
        makeFilter({
          fk_value_col_id: 'col_value',
          fk_link_col_id: undefined,
        }),
      ];
      const tableColumns = [
        makeColumn({ id: 'col_value', title: 'Status' }),
      ];

      readByPkStub.resolves({ Status: 'active' });

      const replaceWithValue = replaceDynamicFieldWithValue(
        null,
        'row_123',
        tableColumns,
        readByPkStub,
      );

      const result = await replaceWithValue(conditions);

      expect(result).to.have.length(1);
      expect(result[0].value).to.equal('active');
      expect(readByPkStub.calledOnce).to.be.true;
      expect(readByPkStub.firstCall.args[0]).to.equal('row_123');
    });

    it('should only call readByPk once for multiple dynamic filters', async () => {
      const conditions = [
        makeFilter({
          id: 'flt_1',
          fk_value_col_id: 'col_a',
          fk_link_col_id: undefined,
        }),
        makeFilter({
          id: 'flt_2',
          fk_value_col_id: 'col_b',
          fk_link_col_id: undefined,
        }),
      ];
      const tableColumns = [
        makeColumn({ id: 'col_a', title: 'FieldA' }),
        makeColumn({ id: 'col_b', title: 'FieldB' }),
      ];

      readByPkStub.resolves({ FieldA: 10, FieldB: 20 });

      const replaceWithValue = replaceDynamicFieldWithValue(
        null,
        'row_1',
        tableColumns,
        readByPkStub,
      );

      const result = await replaceWithValue(conditions);

      expect(result).to.have.length(2);
      expect(result[0].value).to.equal(10);
      expect(result[1].value).to.equal(20);
      expect(readByPkStub.calledOnce).to.be.true;
    });

    it('should merge linkRowData from queryParams into fetched row', async () => {
      const conditions = [
        makeFilter({
          fk_value_col_id: 'col_value',
          fk_link_col_id: undefined,
        }),
      ];
      const tableColumns = [
        makeColumn({ id: 'col_value', title: 'Name' }),
      ];

      readByPkStub.resolves({ Name: 'original', Other: 'data' });

      const queryParams = {
        linkRowData: JSON.stringify({ Name: 'overridden' }),
      };

      const replaceWithValue = replaceDynamicFieldWithValue(
        null,
        'row_1',
        tableColumns,
        readByPkStub,
        queryParams,
      );

      const result = await replaceWithValue(conditions);

      expect(result).to.have.length(1);
      expect(result[0].value).to.equal('overridden');
    });

    it('should ignore invalid linkRowData JSON gracefully', async () => {
      const conditions = [
        makeFilter({
          fk_value_col_id: 'col_value',
          fk_link_col_id: undefined,
        }),
      ];
      const tableColumns = [
        makeColumn({ id: 'col_value', title: 'Name' }),
      ];

      readByPkStub.resolves({ Name: 'original' });

      const queryParams = {
        linkRowData: 'not-valid-json{{{',
      };

      const replaceWithValue = replaceDynamicFieldWithValue(
        null,
        'row_1',
        tableColumns,
        readByPkStub,
        queryParams,
      );

      const result = await replaceWithValue(conditions);

      expect(result).to.have.length(1);
      expect(result[0].value).to.equal('original');
    });

    it('should set _crossTableRowId for cross-table dynamic filter (with fk_link_col_id)', async () => {
      const conditions = [
        makeFilter({
          fk_value_col_id: 'col_value',
          fk_link_col_id: 'col_link',
        }),
      ];
      const tableColumns = [
        makeColumn({ id: 'col_value', title: 'LinkedField' }),
      ];

      const replaceWithValue = replaceDynamicFieldWithValue(
        { LinkedField: 'should_not_be_used' },
        'row_99',
        tableColumns,
        readByPkStub,
      );

      const result = await replaceWithValue(conditions);

      expect(result).to.have.length(1);
      expect(result[0]._crossTableRowId).to.equal('row_99');
      expect(result[0].value).to.be.undefined;
    });

    it('should set _crossTableRowId when value col not found in tableColumns (cross-table)', async () => {
      const conditions = [
        makeFilter({
          fk_value_col_id: 'col_not_in_table',
          fk_link_col_id: undefined,
        }),
      ];
      // tableColumns does NOT contain col_not_in_table
      const tableColumns = [
        makeColumn({ id: 'col_other', title: 'Other' }),
      ];

      const replaceWithValue = replaceDynamicFieldWithValue(
        { Other: 'val' },
        'row_55',
        tableColumns,
        readByPkStub,
      );

      const result = await replaceWithValue(conditions);

      expect(result).to.have.length(1);
      // valueCol not found → falls through to else branch → _crossTableRowId set
      expect(result[0]._crossTableRowId).to.equal('row_55');
    });

    it('should handle group filters recursively', async () => {
      const childFilter = makeFilter({
        fk_value_col_id: 'col_value',
        fk_link_col_id: undefined,
      });
      const groupFilter = makeFilter({
        is_group: true,
        children: [childFilter],
      }) as Filter;

      const tableColumns = [
        makeColumn({ id: 'col_value', title: 'Amount' }),
      ];

      const row = { Amount: 100 };

      const replaceWithValue = replaceDynamicFieldWithValue(
        row,
        '1',
        tableColumns,
        readByPkStub,
      );

      const result = await replaceWithValue([groupFilter]);

      expect(result).to.have.length(1);
      expect(result[0].is_group).to.be.true;
      expect(result[0].children).to.have.length(1);
      expect(result[0].children[0].value).to.equal(100);
    });

    it('should handle mixed static and dynamic filters', async () => {
      const conditions = [
        makeFilter({ value: 'static' }),
        makeFilter({
          fk_value_col_id: 'col_dynamic',
          fk_link_col_id: undefined,
        }),
        makeFilter({
          fk_value_col_id: 'col_cross',
          fk_link_col_id: 'col_link',
        }),
      ];
      const tableColumns = [
        makeColumn({ id: 'col_dynamic', title: 'DynField' }),
        makeColumn({ id: 'col_cross', title: 'CrossField' }),
      ];

      const row = { DynField: 'resolved', CrossField: 'should_not_use' };

      const replaceWithValue = replaceDynamicFieldWithValue(
        row,
        'row_7',
        tableColumns,
        readByPkStub,
      );

      const result = await replaceWithValue(conditions);

      expect(result).to.have.length(3);
      // Static filter unchanged
      expect(result[0].value).to.equal('static');
      // Same-table dynamic filter resolved
      expect(result[1].value).to.equal('resolved');
      // Cross-table dynamic filter annotated with rowId
      expect(result[2]._crossTableRowId).to.equal('row_7');
    });

    it('should handle deeply nested group filters', async () => {
      const leafFilter = makeFilter({
        fk_value_col_id: 'col_value',
        fk_link_col_id: undefined,
      });
      const innerGroup = makeFilter({
        is_group: true,
        children: [leafFilter],
      }) as Filter;
      const outerGroup = makeFilter({
        is_group: true,
        children: [innerGroup],
      }) as Filter;

      const tableColumns = [
        makeColumn({ id: 'col_value', title: 'Deep' }),
      ];

      const row = { Deep: 'nested_value' };

      const replaceWithValue = replaceDynamicFieldWithValue(
        row,
        '1',
        tableColumns,
        readByPkStub,
      );

      const result = await replaceWithValue([outerGroup]);

      expect(result[0].children[0].children[0].value).to.equal('nested_value');
    });

    it('should handle empty conditions array', async () => {
      const replaceWithValue = replaceDynamicFieldWithValue(
        {},
        '1',
        [],
        readByPkStub,
      );

      const result = await replaceWithValue([]);

      expect(result).to.deep.equal([]);
    });

    it('should not mutate original filter objects', async () => {
      const original = makeFilter({
        fk_value_col_id: 'col_value',
        fk_link_col_id: undefined,
        value: 'original_value',
      });
      const tableColumns = [
        makeColumn({ id: 'col_value', title: 'Field' }),
      ];

      const row = { Field: 'new_value' };

      const replaceWithValue = replaceDynamicFieldWithValue(
        row,
        '1',
        tableColumns,
        readByPkStub,
      );

      await replaceWithValue([original]);

      // Original filter should not be mutated
      expect(original.value).to.equal('original_value');
    });
  });
}
