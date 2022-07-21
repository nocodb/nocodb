import { expect } from 'chai';
import SqlClientDecorator from '../../../../../../../src/lib/utils/common/decorators/sqlClientDecorator';
import * as SchemaInspectorObj from 'knex-schema-inspector';
import sinon from 'sinon';

describe('sqlClientDecorator', () => {
  describe('modifyColumnList', () => {
    it('returns a function', () => {
      const fn = SqlClientDecorator.modifyColumnList();
      expect(fn).to.be.a('function');
    });

    describe("decorator's behaviour", () => {
      const decoratorFn = SqlClientDecorator.modifyColumnList();
      const originalColumns = [
        { cn: 'id', pk: false },
        { cn: 'name', pk: false },
      ];
      const ObjectTobeDecorated = {
        get: sinon.fake.returns(undefined),
        value: () => {
          return {
            columnList: () => {
              return Promise.resolve({
                data: {
                  list: originalColumns,
                },
              });
            },
          };
        },
      };
      const columnsFromSchemaInspector = [
        { name: 'id', is_primary_key: true },
        { name: 'name', is_primary_key: false },
      ];
      sinon.replace(
        SchemaInspectorObj,
        'default',
        sinon.fake.returns({
          columnInfo: (_tn) => columnsFromSchemaInspector,
        })
      );
      const decoratedObj = decoratorFn(1, 2, ObjectTobeDecorated);
      const modifiedColumnsWithCorrectPrimaryKey = [
        { cn: 'id', pk: true },
        { cn: 'name', pk: false },
      ];

      it('returns modified columns with correct primary key', async () => {
        const columList = await decoratedObj.value().columnList({ tn: 'test' });
        expect(columList.data.list).to.eql(
          modifiedColumnsWithCorrectPrimaryKey
        );
      });
    });
  });
});
