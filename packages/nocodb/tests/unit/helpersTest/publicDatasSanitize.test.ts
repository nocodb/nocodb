import { expect } from 'chai';
import 'mocha';
import { PublicDatasService } from '../../../src/services/public-datas.service';
import type { NcContext } from '../../../src/interface/config';
import type { Column } from '../../../src/models';

/**
 * Expose protected methods for testing by extending the service class.
 */
class TestablePublicDatasService extends PublicDatasService {
  constructor() {
    super(null as any, null as any, null as any, null as any);
  }

  public testStripHiddenColumnsFromFilters(
    filters: any[],
    visibleColumnIds: Set<string>,
  ) {
    return this.stripHiddenColumnsFromFilters(filters, visibleColumnIds);
  }

  public testStripHiddenColumnsFromSorts(
    sorts: any[],
    visibleColumnIds: Set<string>,
  ) {
    return this.stripHiddenColumnsFromSorts(sorts, visibleColumnIds);
  }

  public testStripHiddenColumnsFromAggregation(
    aggregation: any[],
    visibleColumnIds: Set<string>,
  ) {
    return this.stripHiddenColumnsFromAggregation(aggregation, visibleColumnIds);
  }

  public testValidateGroupByColumnNames(
    context: NcContext,
    columnNameCsv: string,
    visibleInfo: any,
  ) {
    return this.validateGroupByColumnNames(context, columnNameCsv, visibleInfo);
  }

  public testValidateGroupColumnId(
    context: NcContext,
    groupColumnId: string,
    visibleColumnIds: Set<string>,
    groupByColumnIds: Set<string> = new Set(),
  ) {
    return this.validateGroupColumnId(
      context,
      groupColumnId,
      visibleColumnIds,
      groupByColumnIds,
    );
  }

  public testBuildRestrictedAliasColObjMap(visibleInfo: any) {
    return this.buildRestrictedAliasColObjMap(visibleInfo);
  }

  public testSanitizeListArgsForPublicView(
    context: NcContext,
    listArgs: any,
    visibleInfo: any,
  ) {
    return this.sanitizeListArgsForPublicView(context, listArgs, visibleInfo);
  }
}

const mockContext: NcContext = {
  workspace_id: 'ws_test',
  base_id: 'base_test',
  api_version: 'v2' as any,
  timezone: 'UTC',
} as any;

function makeColumn(
  id: string,
  title: string,
  column_name: string,
): Column {
  return { id, title, column_name } as Column;
}

export function publicDatasSanitizeTest() {
  let service: TestablePublicDatasService;

  const visibleColA = makeColumn('col_a', 'Name', 'name');
  const visibleColB = makeColumn('col_b', 'Email', 'email');
  const hiddenColC = makeColumn('col_c', 'SSN', 'ssn');
  const hiddenColD = makeColumn('col_d', 'Salary', 'salary');

  const visibleColumnIds = new Set(['col_a', 'col_b']);
  const visibleColumns = [visibleColA, visibleColB];
  const visibleInfo = {
    visibleColumnIds,
    visibleColumnTitles: new Set(['Name', 'Email']),
    visibleColumnNames: new Set(['name', 'email']),
    visibleColumns,
    groupByColumnIds: new Set<string>(),
    groupByColumnTitles: new Set<string>(),
    groupByColumnNames: new Set<string>(),
    groupByColumns: [] as Column[],
  };

  beforeEach(() => {
    service = new TestablePublicDatasService();
  });

  describe('stripHiddenColumnsFromFilters', () => {
    it('should keep filters on visible columns', () => {
      const filters = [
        { fk_column_id: 'col_a', comparison_op: 'eq', value: 'Alice' },
        { fk_column_id: 'col_b', comparison_op: 'like', value: 'gmail' },
      ];
      const result = service.testStripHiddenColumnsFromFilters(
        filters,
        visibleColumnIds,
      );
      expect(result).to.have.length(2);
    });

    it('should remove filters on hidden columns', () => {
      const filters = [
        { fk_column_id: 'col_a', comparison_op: 'eq', value: 'Alice' },
        { fk_column_id: 'col_c', comparison_op: 'eq', value: '123-45-6789' },
      ];
      const result = service.testStripHiddenColumnsFromFilters(
        filters,
        visibleColumnIds,
      );
      expect(result).to.have.length(1);
      expect(result[0].fk_column_id).to.equal('col_a');
    });

    it('should remove all filters when all reference hidden columns', () => {
      const filters = [
        { fk_column_id: 'col_c', comparison_op: 'eq', value: 'secret' },
        { fk_column_id: 'col_d', comparison_op: 'gt', value: '100000' },
      ];
      const result = service.testStripHiddenColumnsFromFilters(
        filters,
        visibleColumnIds,
      );
      expect(result).to.have.length(0);
    });

    it('should handle nested filter groups recursively', () => {
      const filters = [
        {
          is_group: true,
          logical_op: 'and',
          children: [
            { fk_column_id: 'col_a', comparison_op: 'eq', value: 'Alice' },
            { fk_column_id: 'col_c', comparison_op: 'eq', value: 'hidden' },
          ],
        },
      ];
      const result = service.testStripHiddenColumnsFromFilters(
        filters,
        visibleColumnIds,
      );
      expect(result).to.have.length(1);
      expect(result[0].children).to.have.length(1);
      expect(result[0].children[0].fk_column_id).to.equal('col_a');
    });

    it('should remove empty groups after stripping hidden filters', () => {
      const filters = [
        {
          is_group: true,
          logical_op: 'and',
          children: [
            { fk_column_id: 'col_c', comparison_op: 'eq', value: 'hidden' },
          ],
        },
      ];
      const result = service.testStripHiddenColumnsFromFilters(
        filters,
        visibleColumnIds,
      );
      expect(result).to.have.length(0);
    });

    it('should keep filters without fk_column_id (logical op nodes)', () => {
      const filters = [
        { logical_op: 'and' },
        { fk_column_id: 'col_a', comparison_op: 'eq', value: 'Alice' },
      ];
      const result = service.testStripHiddenColumnsFromFilters(
        filters,
        visibleColumnIds,
      );
      expect(result).to.have.length(2);
    });

    it('should handle empty or null arrays gracefully', () => {
      expect(service.testStripHiddenColumnsFromFilters([], visibleColumnIds)).to
        .be.empty;
      expect(
        service.testStripHiddenColumnsFromFilters(null as any, visibleColumnIds),
      ).to.be.null;
    });
  });

  describe('stripHiddenColumnsFromSorts', () => {
    it('should keep sorts on visible columns', () => {
      const sorts = [{ fk_column_id: 'col_a', direction: 'asc' }];
      const result = service.testStripHiddenColumnsFromSorts(
        sorts,
        visibleColumnIds,
      );
      expect(result).to.have.length(1);
    });

    it('should remove sorts on hidden columns', () => {
      const sorts = [
        { fk_column_id: 'col_a', direction: 'asc' },
        { fk_column_id: 'col_c', direction: 'desc' },
      ];
      const result = service.testStripHiddenColumnsFromSorts(
        sorts,
        visibleColumnIds,
      );
      expect(result).to.have.length(1);
      expect(result[0].fk_column_id).to.equal('col_a');
    });
  });

  describe('stripHiddenColumnsFromAggregation', () => {
    it('should keep aggregations on visible columns', () => {
      const agg = [{ field: 'col_a', type: 'count' }];
      const result = service.testStripHiddenColumnsFromAggregation(
        agg,
        visibleColumnIds,
      );
      expect(result).to.have.length(1);
    });

    it('should remove aggregations on hidden columns', () => {
      const agg = [
        { field: 'col_a', type: 'count' },
        { field: 'col_d', type: 'sum' },
      ];
      const result = service.testStripHiddenColumnsFromAggregation(
        agg,
        visibleColumnIds,
      );
      expect(result).to.have.length(1);
      expect(result[0].field).to.equal('col_a');
    });
  });

  describe('validateGroupByColumnNames', () => {
    it('should pass for visible column titles', () => {
      expect(() =>
        service.testValidateGroupByColumnNames(mockContext, 'Name', visibleInfo),
      ).to.not.throw();
    });

    it('should pass for visible column_names', () => {
      expect(() =>
        service.testValidateGroupByColumnNames(
          mockContext,
          'email',
          visibleInfo,
        ),
      ).to.not.throw();
    });

    it('should pass for comma-separated visible columns', () => {
      expect(() =>
        service.testValidateGroupByColumnNames(
          mockContext,
          'Name,Email',
          visibleInfo,
        ),
      ).to.not.throw();
    });

    it('should throw for hidden column title', () => {
      expect(() =>
        service.testValidateGroupByColumnNames(mockContext, 'SSN', visibleInfo),
      ).to.throw();
    });

    it('should throw for hidden column_name', () => {
      expect(() =>
        service.testValidateGroupByColumnNames(
          mockContext,
          'salary',
          visibleInfo,
        ),
      ).to.throw();
    });

    it('should throw if any column in CSV is hidden', () => {
      expect(() =>
        service.testValidateGroupByColumnNames(
          mockContext,
          'Name,SSN',
          visibleInfo,
        ),
      ).to.throw();
    });

    it('should not throw for empty string', () => {
      expect(() =>
        service.testValidateGroupByColumnNames(mockContext, '', visibleInfo),
      ).to.not.throw();
    });

    it('should pass for hidden column title used in group-by', () => {
      const infoWithGroupBy = {
        ...visibleInfo,
        groupByColumnTitles: new Set(['SSN']),
        groupByColumnNames: new Set(['ssn']),
      };
      expect(() =>
        service.testValidateGroupByColumnNames(
          mockContext,
          'SSN',
          infoWithGroupBy,
        ),
      ).to.not.throw();
    });

    it('should pass for hidden column_name used in group-by', () => {
      const infoWithGroupBy = {
        ...visibleInfo,
        groupByColumnTitles: new Set(['SSN']),
        groupByColumnNames: new Set(['ssn']),
      };
      expect(() =>
        service.testValidateGroupByColumnNames(
          mockContext,
          'ssn',
          infoWithGroupBy,
        ),
      ).to.not.throw();
    });

    it('should throw for hidden column not in group-by', () => {
      const infoWithGroupBy = {
        ...visibleInfo,
        groupByColumnTitles: new Set(['SSN']),
        groupByColumnNames: new Set(['ssn']),
      };
      expect(() =>
        service.testValidateGroupByColumnNames(
          mockContext,
          'Salary',
          infoWithGroupBy,
        ),
      ).to.throw();
    });
  });

  describe('validateGroupColumnId', () => {
    it('should pass for visible column ID', () => {
      expect(() =>
        service.testValidateGroupColumnId(
          mockContext,
          'col_a',
          visibleColumnIds,
        ),
      ).to.not.throw();
    });

    it('should throw for hidden column ID', () => {
      expect(() =>
        service.testValidateGroupColumnId(
          mockContext,
          'col_c',
          visibleColumnIds,
        ),
      ).to.throw();
    });

    it('should not throw for empty groupColumnId', () => {
      expect(() =>
        service.testValidateGroupColumnId(mockContext, '', visibleColumnIds),
      ).to.not.throw();
    });

    it('should pass for hidden column used in group-by', () => {
      const groupByIds = new Set(['col_c']);
      expect(() =>
        service.testValidateGroupColumnId(
          mockContext,
          'col_c',
          visibleColumnIds,
          groupByIds,
        ),
      ).to.not.throw();
    });

    it('should throw for hidden column not in group-by', () => {
      const groupByIds = new Set(['col_c']);
      expect(() =>
        service.testValidateGroupColumnId(
          mockContext,
          'col_d',
          visibleColumnIds,
          groupByIds,
        ),
      ).to.throw();
    });
  });

  describe('buildRestrictedAliasColObjMap', () => {
    it('should include visible columns by both id and title', () => {
      const map = service.testBuildRestrictedAliasColObjMap(visibleInfo);
      expect(map).to.have.property('col_a');
      expect(map).to.have.property('col_b');
      expect(map).to.have.property('Name');
      expect(map).to.have.property('Email');
    });

    it('should not include hidden columns', () => {
      const map = service.testBuildRestrictedAliasColObjMap(visibleInfo);
      expect(map).to.not.have.property('col_c');
      expect(map).to.not.have.property('col_d');
      expect(map).to.not.have.property('SSN');
      expect(map).to.not.have.property('Salary');
    });

    it('should include group-by columns', () => {
      const infoWithGroupBy = {
        ...visibleInfo,
        groupByColumns: [hiddenColC],
      };
      const map = service.testBuildRestrictedAliasColObjMap(infoWithGroupBy);
      expect(map).to.have.property('col_c');
      expect(map).to.have.property('SSN');
      expect(map).to.have.property('ssn');
      // non-group-by hidden column still excluded
      expect(map).to.not.have.property('col_d');
      expect(map).to.not.have.property('Salary');
    });
  });

  describe('sanitizeListArgsForPublicView', () => {
    it('should strip filterArr entries referencing hidden columns', () => {
      const listArgs = {
        filterArr: [
          { fk_column_id: 'col_a', comparison_op: 'eq', value: 'Alice' },
          { fk_column_id: 'col_c', comparison_op: 'eq', value: '123' },
        ],
      };
      service.testSanitizeListArgsForPublicView(
        mockContext,
        listArgs,
        visibleInfo,
      );
      expect(listArgs.filterArr).to.have.length(1);
      expect(listArgs.filterArr[0].fk_column_id).to.equal('col_a');
    });

    it('should strip sortArr entries referencing hidden columns', () => {
      const listArgs = {
        sortArr: [
          { fk_column_id: 'col_a', direction: 'asc' },
          { fk_column_id: 'col_d', direction: 'desc' },
        ],
      };
      service.testSanitizeListArgsForPublicView(
        mockContext,
        listArgs,
        visibleInfo,
      );
      expect(listArgs.sortArr).to.have.length(1);
      expect(listArgs.sortArr[0].fk_column_id).to.equal('col_a');
    });

    it('should delete where after parsing and merge into filterArr', () => {
      const listArgs = {
        where: '(Name,eq,Alice)',
        filterArr: [
          { fk_column_id: 'col_b', comparison_op: 'like', value: 'gmail' },
        ],
      };
      service.testSanitizeListArgsForPublicView(
        mockContext,
        listArgs,
        visibleInfo,
      );
      // where should be deleted
      expect(listArgs).to.not.have.property('where');
      // filterArr should have the original filter plus parsed where filters
      expect(listArgs.filterArr.length).to.be.greaterThanOrEqual(1);
    });

    it('should handle listArgs with no filters/sorts/where', () => {
      const listArgs = { limit: 10, offset: 0 };
      service.testSanitizeListArgsForPublicView(
        mockContext,
        listArgs,
        visibleInfo,
      );
      expect(listArgs).to.not.have.property('where');
      expect(listArgs).to.have.property('limit', 10);
    });

    it('should strip hidden columns from fields (comma-separated string)', () => {
      const listArgs: any = { fields: 'Name,SSN,Email' };
      service.testSanitizeListArgsForPublicView(
        mockContext,
        listArgs,
        visibleInfo,
      );
      expect(listArgs.fields).to.equal('Name,Email');
    });

    it('should strip hidden columns from fields (array)', () => {
      const listArgs: any = { fields: ['Name', 'SSN', 'Email'] };
      service.testSanitizeListArgsForPublicView(
        mockContext,
        listArgs,
        visibleInfo,
      );
      expect(listArgs.fields).to.deep.equal(['Name', 'Email']);
    });

    it('should remove fields entirely when all are hidden', () => {
      const listArgs: any = { fields: 'SSN,Salary' };
      service.testSanitizeListArgsForPublicView(
        mockContext,
        listArgs,
        visibleInfo,
      );
      expect(listArgs.fields).to.be.undefined;
    });

    it('should accept fields by column_name', () => {
      const listArgs: any = { fields: 'name,ssn' };
      service.testSanitizeListArgsForPublicView(
        mockContext,
        listArgs,
        visibleInfo,
      );
      expect(listArgs.fields).to.equal('name');
    });

    it('should accept fields by column id', () => {
      const listArgs: any = { fields: 'col_a,col_c' };
      service.testSanitizeListArgsForPublicView(
        mockContext,
        listArgs,
        visibleInfo,
      );
      expect(listArgs.fields).to.equal('col_a');
    });

    it('should strip hidden columns from f alias', () => {
      const listArgs: any = { f: 'Name,SSN' };
      service.testSanitizeListArgsForPublicView(
        mockContext,
        listArgs,
        visibleInfo,
      );
      expect(listArgs.f).to.equal('Name');
    });

    it('should handle single hidden field in fields', () => {
      const listArgs: any = { fields: 'SSN' };
      service.testSanitizeListArgsForPublicView(
        mockContext,
        listArgs,
        visibleInfo,
      );
      expect(listArgs.fields).to.be.undefined;
    });
  });
}
