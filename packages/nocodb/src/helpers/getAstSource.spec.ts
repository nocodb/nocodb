import { RelationTypes, UITypes } from 'nocodb-sdk';
import getAst from './getAst';

describe('getAst delete snapshot planning', () => {
  const makeModel = ({ throwOnVirtualColOptions = true } = {}) => {
    const relationDependencyColumn = {
      id: 'col_relation_fk',
      title: 'RelationFk',
      column_name: 'relation_fk',
      uidt: UITypes.ForeignKey,
    } as any;
    const lookupTargetColumn = {
      id: 'col_lookup_target',
      title: 'LookupTarget',
      column_name: 'lookup_target',
      uidt: UITypes.SingleLineText,
    } as any;
    const relationColumn: any = {
      id: 'col_relation',
      title: 'Relation',
      column_name: 'relation',
      uidt: UITypes.LinkToAnotherRecord,
      getColOptions: jest.fn(async () => ({
        type: RelationTypes.BELONGS_TO,
        getRelContext: jest.fn(() => ({ refContext: {} })),
        getChildColumn: jest.fn(async () => relationDependencyColumn),
      })),
    };
    const lookupColOptions = {
      getRelationColumn: jest.fn(async () => relationColumn),
      getLookupColumn: jest.fn(async () => lookupTargetColumn),
    };
    const virtualColOptionsImpl = throwOnVirtualColOptions
      ? async () => {
          throw new Error('virtual dependencies should not be expanded');
        }
      : async () => lookupColOptions;

    const columns: any[] = [
      {
        id: 'col_id',
        title: 'Id',
        column_name: 'id',
        uidt: UITypes.ID,
        pk: true,
      },
      {
        id: 'col_name',
        title: 'Name',
        column_name: 'name',
        uidt: UITypes.SingleLineText,
      },
      {
        id: 'col_created_time',
        title: 'CreatedTime',
        column_name: 'created_at',
        uidt: UITypes.CreatedTime,
        system: true,
      },
      {
        id: 'col_last_modified_time',
        title: 'LastModifiedTime',
        column_name: 'updated_at',
        uidt: UITypes.LastModifiedTime,
        system: true,
      },
      {
        id: 'col_created_by',
        title: 'CreatedBy',
        column_name: 'created_by',
        uidt: UITypes.CreatedBy,
        system: true,
      },
      {
        id: 'col_last_modified_by',
        title: 'LastModifiedBy',
        column_name: 'updated_by',
        uidt: UITypes.LastModifiedBy,
        system: true,
      },
      {
        id: 'col_formula',
        title: 'Formula',
        column_name: 'formula',
        uidt: UITypes.Formula,
      },
      {
        id: 'col_rollup',
        title: 'Rollup',
        column_name: 'rollup',
        uidt: UITypes.Rollup,
      },
      {
        id: 'col_lookup',
        title: 'Lookup',
        column_name: 'lookup',
        uidt: UITypes.Lookup,
        getColOptions: jest.fn(virtualColOptionsImpl),
      },
      {
        id: 'col_link',
        title: 'Link',
        column_name: 'link',
        uidt: UITypes.LinkToAnotherRecord,
        getColOptions: jest.fn(
          throwOnVirtualColOptions
            ? virtualColOptionsImpl
            : async () => ({
                type: RelationTypes.BELONGS_TO,
                getChildColumn: jest.fn(async () => relationDependencyColumn),
              }),
        ),
      },
    ];

    return {
      columns,
      primaryKeys: [columns[0]],
      displayValue: columns[1],
    } as any;
  };

  it('excludes unsafe virtual columns when building delete snapshot dependencies', async () => {
    const model = makeModel();

    const { ast, dependencyFields } = await getAst({} as any, {
      model,
      query: {},
      getHiddenColumn: true,
      excludeVirtualColumns: true,
    });

    expect(ast).toMatchObject({
      Id: 1,
      Name: 1,
      CreatedTime: 1,
      LastModifiedTime: 1,
      CreatedBy: true,
      LastModifiedBy: true,
      Formula: false,
      Rollup: false,
      Lookup: false,
      Link: false,
    });
    expect(dependencyFields.fieldsSet).toEqual(
      new Set([
        'Id',
        'Name',
        'CreatedTime',
        'LastModifiedTime',
        'CreatedBy',
        'LastModifiedBy',
      ]),
    );
    expect(
      model.columns.find((col) => col.title === 'Lookup').getColOptions,
    ).not.toHaveBeenCalled();
    expect(
      model.columns.find((col) => col.title === 'Link').getColOptions,
    ).not.toHaveBeenCalled();
  });

  it('keeps normal read planning unchanged when virtual exclusion is disabled', async () => {
    const model = makeModel({ throwOnVirtualColOptions: false });

    const { ast } = await getAst({} as any, {
      model,
      query: {},
      getHiddenColumn: true,
      excludeVirtualColumns: false,
    });

    expect(ast).toMatchObject({
      Id: 1,
      Name: 1,
      Formula: 1,
      Rollup: 1,
      Lookup: 1,
      Link: 1,
    });
    expect(
      model.columns.find((col) => col.title === 'Lookup').getColOptions,
    ).toHaveBeenCalled();
    expect(
      model.columns.find((col) => col.title === 'Link').getColOptions,
    ).toHaveBeenCalled();
  });
});
