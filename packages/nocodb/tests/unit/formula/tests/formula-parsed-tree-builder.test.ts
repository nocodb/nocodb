import { FormulaDataTypes, JSEPNode } from 'nocodb-sdk';
import { expect } from 'chai';
import sinon from 'sinon';
import {
  binaryExpressionBuilder,
  callExpressionBuilder,
} from '../../../../src/db/formulav2/parsed-tree-builder';
import mapFunctionName from '../../../../src/db/mapFunctionName';
import { initInitialModel } from '../initModel';
import type {
  FnParsedTreeNode,
  TAliasToColumn,
} from '../../../../src/db/formulav2/formula-query-builder.types';
import type { NcContext, ParsedFormulaNode, UITypes } from 'nocodb-sdk';
import type { Model } from '../../../../src/models';

const mapFunctionNameStub = sinon.stub();
function formulaParsedTreeBuilderTests() {
  let mockKnex: any; // Using any for CustomKnex due to complex mocking
  let mockFn: sinon.SinonStub;
  let aliasToColumn: TAliasToColumn;
  let columnIdToUidt: Record<string, UITypes>;

  let _setup;
  let _context;
  let _ctx: {
    workspace_id: string;
    base_id: string;
  };
  let _base;
  let _tables;
  let _view;
  let _baseModelSql;

  beforeEach(async () => {
    mockKnex = {
      raw: sinon.stub().callsFake((sql: string) => ({
        toQuery: () => sql,
        wrap: (left: string, right: string) => ({
          toQuery: () => `${left}${sql}${right}`,
        }),
      })),
      clientType: sinon.stub(),
    };
    const setup = await initInitialModel();
    _setup = setup;
    _context = setup.context;
    _ctx = setup.ctx;
    _base = setup.base;
    _tables = setup.tables;

    mockFn = sinon
      .stub()
      .callsFake(async (_pt: ParsedFormulaNode | FnParsedTreeNode) => ({
        builder: {
          toQuery: () => {
            return JSON.stringify(_pt);
          },
        },
      }));
    aliasToColumn = {};
    columnIdToUidt = {};
  });

  afterEach(() => {
    sinon.restore(); // Restore all stubs after each test
  });

  describe('callExpressionBuilder', () => {
    // Test cases for ADD/SUM
    it('should handle ADD with single argument, applying COALESCE', async () => {
      const pt = {
        type: JSEPNode.CALL_EXP,
        callee: { type: 'Identifier', name: 'ADD' },
        arguments: [{ type: JSEPNode.IDENTIFIER, name: 'col1' }],
      };
      const result = await callExpressionBuilder({
        context: _ctx,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        aliasToColumn,
        knex: mockKnex,
        model: _tables.table1,
        columnIdToUidt,
      });
      const resultJsonStr = result.builder.toQuery();
      expect(resultJsonStr).to.satisfy((res: string) => {
        return (
          res.indexOf('CallExpression') >= 0 &&
          res.indexOf(`{"type":"Identifier","name":"COALESCE"}`) >= 0
        );
      }, 'CallExpression COALESCE not found in query');
      expect(resultJsonStr).to.satisfy((res: string) => {
        return res.indexOf(`{"type":"Identifier","name":"col1"}`) >= 0;
      }, 'Col 1 not found in args');
    });

    it('should handle SUM with multiple arguments, applying COALESCE and binary operation', async () => {
      const pt = {
        type: JSEPNode.CALL_EXP,
        callee: { type: 'Identifier', name: 'SUM' },
        arguments: [
          { type: JSEPNode.IDENTIFIER, name: 'col1' },
          { type: JSEPNode.IDENTIFIER, name: 'col2' },
          { type: JSEPNode.LITERAL, value: 5 },
        ],
      };
      const result = await callExpressionBuilder({
        context: _ctx,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        aliasToColumn,
        knex: mockKnex,
        model: _tables.table1,
        columnIdToUidt,
      });
      const resultJsonStr = result.builder.toQuery();
      expect(resultJsonStr).to.satisfy((res: string) => {
        return (
          res.indexOf('BinaryExpression') >= 0 &&
          res.indexOf(`"operator":"+"`) >= 0
        );
      }, 'Binary expression and operator + not found in result');
      expect(resultJsonStr).to.satisfy((res: string) => {
        return (
          res.indexOf(`{"type":"Identifier","name":"col1"}`) >= 0 &&
          res.indexOf(`{"type":"Identifier","name":"col2"}`) >= 0
        );
      }, 'Col 1 & col 2 not found in args');
      expect(resultJsonStr).to.satisfy((res: string) => {
        return res.indexOf(`{"type":"Literal","value":5}`) >= 0;
      }, 'Literal value 5 not found in args');
    });

    // Test cases for CONCAT
    it('should use || operator for CONCAT in sqlite3 with multiple arguments', async () => {
      (mockKnex.clientType as sinon.SinonStub).returns('sqlite3');
      const pt = {
        type: JSEPNode.CALL_EXP,
        callee: { type: 'Identifier', name: 'CONCAT' },
        arguments: [
          { type: JSEPNode.IDENTIFIER, name: 'str1' },
          { type: JSEPNode.IDENTIFIER, name: 'str2' },
        ],
      };
      const result = await callExpressionBuilder({
        context: _ctx,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        aliasToColumn,
        knex: mockKnex,
        model: _tables.table1,
        columnIdToUidt,
      });
      const resultJsonStr = result.builder.toQuery();
      expect(resultJsonStr).to.satisfy((res: string) => {
        return (
          res.indexOf('BinaryExpression') >= 0 &&
          res.indexOf(`"operator":"||"`) >= 0
        );
      }, 'Binary expression and operator || not found in result');
      expect(resultJsonStr).to.satisfy((res: string) => {
        return (
          res.indexOf(`{"type":"Identifier","name":"str1"}`) >= 0 &&
          res.indexOf(`{"type":"Identifier","name":"str2"}`) >= 0
        );
      }, 'Str 1 & str 2 not found in args');
    });

    // Test cases for URL
    it('should build URL string with escaped parentheses', async () => {
      const pt = {
        type: JSEPNode.CALL_EXP,
        callee: { type: 'Identifier', name: 'URL' },
        arguments: [
          {
            type: JSEPNode.IDENTIFIER,
            name: 'col1',
          },
          {
            type: JSEPNode.IDENTIFIER,
            name: 'labelCol',
            value: 'My Label (with parens)',
          },
        ],
      };
      const result = await callExpressionBuilder({
        context: _ctx,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        aliasToColumn,
        knex: mockKnex,
        model: _tables.table1,
        columnIdToUidt,
      });
      const resultJsonStr = result.builder.toQuery();

      expect(resultJsonStr).to.satisfy((res: string) => {
        return res.indexOf('{"type":"Literal","value":"URI::(') >= 0;
      }, 'Lateral starts with URI::(');
      expect(resultJsonStr).to.satisfy((res: string) => {
        return res.indexOf(`{"type":"Identifier","name":"col1"}`) >= 0;
      }, 'Col 1 not found in args');
    });

    it('should build raw SQL for other functions', async () => {
      mockFn.callsFake(async (arg: any) => ({
        builder: { toQuery: () => `'${arg.value || arg.name}'` },
      }));
      const pt = {
        type: JSEPNode.CALL_EXP,
        callee: { type: 'Identifier', name: 'SOME_FUNC' },
        arguments: [
          { type: JSEPNode.LITERAL, value: 'hello' },
          { type: JSEPNode.IDENTIFIER, name: 'col1' },
        ],
      };
      const result = await callExpressionBuilder({
        context: _ctx,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        aliasToColumn,
        knex: mockKnex,
        model: _tables.table1,
        columnIdToUidt,
      });
      const resultQuery = result.builder.toQuery();
      expect(resultQuery).to.eq(`SOME_FUNC('hello','col1')`);
    });
  });

  describe('binaryExpressionBuilder', () => {
    it('should convert & operator to CONCAT call', async () => {
      const pt = {
        type: JSEPNode.BINARY_EXP,
        operator: '&',
        left: { type: JSEPNode.IDENTIFIER, name: 'str1' },
        right: { type: JSEPNode.IDENTIFIER, name: 'str2' },
      };
      const result = await binaryExpressionBuilder({
        context: _ctx,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        knex: mockKnex,
        columnIdToUidt,
        aliasToColumn,
        model: _tables.table1,
      });
      const resultJsonStr = result.builder.toQuery();
      expect(resultJsonStr).to.satisfy((res: string) => {
        return (
          res.indexOf('CallExpression') >= 0 &&
          res.indexOf(`{"type":"Identifier","name":"CONCAT"}`) >= 0
        );
      }, 'CallExpression CONCAT not found in query');
    });
  });
}

export function formulaParsedTreeBuilderTest() {
  describe('FormulaParsedTreeBuilderTests', formulaParsedTreeBuilderTests);
}
