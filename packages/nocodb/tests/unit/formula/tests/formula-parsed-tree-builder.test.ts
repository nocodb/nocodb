import { FormulaDataTypes, JSEPNode, UITypes } from 'nocodb-sdk';
import { expect } from 'chai';
import sinon from 'sinon';
import {
  binaryExpressionBuilder,
  callExpressionBuilder,
} from '../../../../src/db/formulav2/parsed-tree-builder';
import mapFunctionName from '../../../../src/db/mapFunctionName';
import type {
  FnParsedTreeNode,
  TAliasToColumn,
} from '../../../../src/db/formulav2/formula-query-builder.types';
import type { NcContext, ParsedFormulaNode } from 'nocodb-sdk';
import type { Model } from '../../../../src/models';

const mapFunctionNameStub = sinon.stub();
function formulaParsedTreeBuilderTests() {
  let mockKnex: any; // Using any for CustomKnex due to complex mocking
  let mockContext: NcContext;
  let mockModel: Model;
  let mockFn: sinon.SinonStub;
  let aliasToColumn: TAliasToColumn;
  let columnIdToUidt: Record<string, UITypes>;
  let convertDateFormatForConcatStub: sinon.SinonStub;

  beforeEach(() => {
    mockKnex = {
      raw: sinon.stub().callsFake((sql: string) => ({
        toQuery: () => sql,
        wrap: (left: string, right: string) => ({
          toQuery: () => `${left}${sql}${right}`,
        }),
      })),
      clientType: sinon.stub(),
    };

    mockContext = {} as NcContext;
    mockModel = {} as Model;
    mockFn = sinon
      .stub()
      .callsFake(async (pt: ParsedFormulaNode | FnParsedTreeNode) => ({
        builder: {
          toQuery: () => {
            if ((pt as ParsedFormulaNode).type === JSEPNode.LITERAL) {
              return typeof (pt as ParsedFormulaNode).value === 'string'
                ? `'${(pt as ParsedFormulaNode).value}'`
                : `${(pt as ParsedFormulaNode).value}`;
            }
            if ((pt as ParsedFormulaNode).type === JSEPNode.IDENTIFIER) {
              return `"${(pt as ParsedFormulaNode).name}"`;
            }
            if (
              (pt as ParsedFormulaNode).type === JSEPNode.CALL_EXP &&
              ((pt as ParsedFormulaNode).callee as any).name === 'COALESCE'
            ) {
              return `COALESCE(${(
                (pt as ParsedFormulaNode).arguments as ParsedFormulaNode[]
              )
                .map((arg) =>
                  arg.type === JSEPNode.LITERAL ? arg.value : `"${arg.name}"`,
                )
                .join(', ')})`;
            }
            return `(${(pt as any).left ? (pt as any).left.name : ''} ${
              (pt as any).operator
            } ${(pt as any).right ? (pt as any).right.name : ''})`;
          },
        },
      }));
    aliasToColumn = {};
    columnIdToUidt = {};

    mapFunctionNameStub.resetHistory();
    (mapFunctionName as any).default = mapFunctionNameStub;

    (mockKnex.clientType as sinon.SinonStub).returns('pg');
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
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        aliasToColumn,
        knex: mockKnex,
        model: mockModel,
        columnIdToUidt,
      });
      expect(result.builder.toQuery()).to.equal('ADD(COALESCE("col1", 0))');
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
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        aliasToColumn,
        knex: mockKnex,
        model: mockModel,
        columnIdToUidt,
      });
      expect(result.builder.toQuery()).to.match(
        /SUM\(COALESCE\("col1", 0\).*\)/,
      );
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
      await callExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        aliasToColumn,
        knex: mockKnex,
        model: mockModel,
        columnIdToUidt,
      });
      expect(mockFn).to.have.been.calledWith(
        sinon.match.has('type', JSEPNode.BINARY_EXP),
        '',
      );
    });

    it('should use || operator for CONCAT in sqlite3 with single argument', async () => {
      (mockKnex.clientType as sinon.SinonStub).returns('sqlite3');
      const pt = {
        type: JSEPNode.CALL_EXP,
        callee: { type: 'Identifier', name: 'CONCAT' },
        arguments: [{ type: JSEPNode.IDENTIFIER, name: 'str1' }],
      };
      await callExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        aliasToColumn,
        knex: mockKnex,
        model: mockModel,
        columnIdToUidt,
      });
      expect(mockFn).to.have.been.calledWith(pt.arguments[0], '');
    });

    it('should call mapFunctionName for CONCAT in databricks', async () => {
      (mockKnex.clientType as sinon.SinonStub).returns('databricks');
      mapFunctionNameStub.returns({
        builder: { toQuery: () => 'DATABRICKS_CONCAT_QUERY' },
      });
      const pt = {
        type: JSEPNode.CALL_EXP,
        callee: { type: 'Identifier', name: 'CONCAT' },
        arguments: [{ type: JSEPNode.IDENTIFIER, name: 'str1' }],
      };
      const result = await callExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        aliasToColumn,
        knex: mockKnex,
        model: mockModel,
        columnIdToUidt,
      });
      expect(mapFunctionNameStub).to.have.been.calledWith(
        sinon.match.has('pt', pt),
      );
      expect(result.builder.toQuery()).to.equal('DATABRICKS_CONCAT_QUERY');
    });

    it('should apply IFNULL for CONCAT arguments in mysql2', async () => {
      (mockKnex.clientType as sinon.SinonStub).returns('mysql2');
      mockFn.callsFake(async (arg: any) => ({
        builder: { toQuery: () => `SQL_QUERY_FOR_${arg.name}` },
      }));
      const pt = {
        type: JSEPNode.CALL_EXP,
        callee: { type: 'Identifier', name: 'CONCAT' },
        arguments: [
          { type: JSEPNode.IDENTIFIER, name: 'str1' },
          { type: JSEPNode.IDENTIFIER, name: 'str2' },
        ],
      };
      const result = await callExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        aliasToColumn,
        knex: mockKnex,
        model: mockModel,
        columnIdToUidt,
      });
      expect(result.builder.toQuery()).to.equal(
        `CONCAT(IFNULL(SQL_QUERY_FOR_str1, ''),IFNULL(SQL_QUERY_FOR_str2, ''))`,
      );
    });

    // Test cases for URL
    it('should build URL string with escaped parentheses', async () => {
      mockFn.callsFake(async (arg: any) => ({
        builder: {
          toQuery: () => {
            if (arg.type === JSEPNode.LITERAL) return `'${arg.value}'`;
            if (
              arg.type === JSEPNode.CALL_EXP &&
              arg.callee.name === 'REPLACE'
            ) {
              const original = arg.arguments[0];
              const find = arg.arguments[1].value;
              const replace = arg.arguments[2].value;
              return original.type === JSEPNode.IDENTIFIER
                ? `'${original.name}'.replace(/${find}/g, '${replace}')`
                : `'${original.value}'.replace(/${find}/g, '${replace}')`;
            }
            return 'ARG_QUERY';
          },
        },
      }));
      const pt = {
        type: JSEPNode.CALL_EXP,
        callee: { type: 'Identifier', name: 'URL' },
        arguments: [
          {
            type: JSEPNode.IDENTIFIER,
            name: 'urlCol',
            value: 'http://example.com/a(b)',
          },
          {
            type: JSEPNode.IDENTIFIER,
            name: 'labelCol',
            value: 'My Label (with parens)',
          },
        ],
      };
      const result = await callExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        aliasToColumn,
        knex: mockKnex,
        model: mockModel,
        columnIdToUidt,
      });
      // The expected output is quite long, so we'll check for key components.
      expect(result.builder.toQuery()).to.include(`CONCAT('URI::( '`);
      expect(result.builder.toQuery()).to.include(
        `'urlCol'.replace(/\\(/g, '\\(').replace(/\\)/g, '\\)')`,
      );
      expect(result.builder.toQuery()).to.include(`' )'`);
      expect(result.builder.toQuery()).to.include(`' LABEL::( '`);
      expect(result.builder.toQuery()).to.include(
        `'labelCol'.replace(/\\(/g, '\\(').replace(/\\)/g, '\\)')`,
      );
    });

    // Test cases for default behavior
    it('should call mapFunctionName for unknown functions', async () => {
      mapFunctionNameStub.returns({
        builder: { toQuery: () => 'MAPPED_FUNCTION_QUERY' },
      });
      const pt = {
        type: JSEPNode.CALL_EXP,
        callee: { type: 'Identifier', name: 'UNKNOWN_FUNC' },
        arguments: [{ type: JSEPNode.IDENTIFIER, name: 'arg1' }],
      };
      const result = await callExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        aliasToColumn,
        knex: mockKnex,
        model: mockModel,
        columnIdToUidt,
      });
      expect(mapFunctionNameStub).to.have.been.calledWith(
        sinon.match.has('pt', pt),
      );
      expect(result.builder.toQuery()).to.equal('MAPPED_FUNCTION_QUERY');
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
          { type: JSEPNode.IDENTIFIER, name: 'world' },
        ],
      };
      const result = await callExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        aliasToColumn,
        knex: mockKnex,
        model: mockModel,
        columnIdToUidt,
      });
      expect(result.builder.toQuery()).to.equal(`SOME_FUNC('hello','world')`);
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
      await binaryExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        knex: mockKnex,
        columnIdToUidt,
        aliasToColumn,
        model: mockModel,
      });
      expect(mockFn).to.have.been.calledWith(
        sinon.match.has('type', JSEPNode.CALL_EXP),
        '',
      );
      expect(mockFn.lastCall.args[0].callee.name).to.equal('CONCAT');
    });

    it('should convert + operator to CONCAT call if dataType is STRING', async () => {
      const pt = {
        type: JSEPNode.BINARY_EXP,
        operator: '+',
        dataType: FormulaDataTypes.STRING,
        left: { type: JSEPNode.IDENTIFIER, name: 'str1' },
        right: { type: JSEPNode.IDENTIFIER, name: 'str2' },
      };
      await binaryExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        knex: mockKnex,
        columnIdToUidt,
        aliasToColumn,
        model: mockModel,
      });
      expect(mockFn).to.have.been.calledWith(
        sinon.match.has('type', JSEPNode.CALL_EXP),
        '',
      );
      expect(mockFn.lastCall.args[0].callee.name).to.equal('CONCAT');
    });

    it('should handle == operator with BLANK on left for string type', async () => {
      const pt = {
        type: JSEPNode.BINARY_EXP,
        operator: '==',
        left: { type: JSEPNode.CALL_EXP, callee: { name: 'BLANK' } },
        right: {
          type: JSEPNode.IDENTIFIER,
          name: 'someStr',
          dataType: FormulaDataTypes.STRING,
        },
      };
      await binaryExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        knex: mockKnex,
        columnIdToUidt,
        aliasToColumn,
        model: mockModel,
      });
      expect(mockFn).to.have.been.calledWith(
        sinon.match.has('callee', sinon.match.has('name', 'ISBLANK')),
        '',
      );
    });

    it('should handle != operator with BLANK on right for numeric type', async () => {
      const pt = {
        type: JSEPNode.BINARY_EXP,
        operator: '!=',
        left: {
          type: JSEPNode.IDENTIFIER,
          name: 'someNum',
          dataType: FormulaDataTypes.NUMERIC,
        },
        right: { type: JSEPNode.CALL_EXP, callee: { name: 'BLANK' } },
      };
      await binaryExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        knex: mockKnex,
        columnIdToUidt,
        aliasToColumn,
        model: mockModel,
      });
      expect(mockFn).to.have.been.calledWith(
        sinon.match.has('callee', sinon.match.has('name', 'ISNOTNULL')),
        '',
      );
    });

    it('should convert operands to STRING if data types mismatch for == operator', async () => {
      const pt = {
        type: JSEPNode.BINARY_EXP,
        operator: '==',
        left: {
          type: JSEPNode.IDENTIFIER,
          name: 'numCol',
          dataType: FormulaDataTypes.NUMERIC,
        },
        right: {
          type: JSEPNode.IDENTIFIER,
          name: 'strCol',
          dataType: FormulaDataTypes.STRING,
        },
      };
      await binaryExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        knex: mockKnex,
        columnIdToUidt,
        aliasToColumn,
        model: mockModel,
      });
      expect(mockFn).to.have.been.calledWith(
        sinon.match.has('callee', sinon.match.has('name', 'STRING')),
        '=',
      );
    });

    it('should convert operands to FLOAT for / operator', async () => {
      const pt = {
        type: JSEPNode.BINARY_EXP,
        operator: '/',
        left: { type: JSEPNode.IDENTIFIER, name: 'intCol1' },
        right: { type: JSEPNode.IDENTIFIER, name: 'intCol2' },
      };
      await binaryExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        knex: mockKnex,
        columnIdToUidt,
        aliasToColumn,
        model: mockModel,
      });
      expect(mockFn).to.have.been.calledWith(
        sinon.match.has('callee', sinon.match.has('name', 'FLOAT')),
        '/',
      );
    });

    it('should handle date comparison with empty string for pg client', async () => {
      columnIdToUidt = { col1: UITypes.Date };
      mockFn.callsFake(async (arg: any) => ({
        builder: { toQuery: () => `"${arg.name}"` },
      }));
      const pt = {
        type: JSEPNode.BINARY_EXP,
        operator: '=',
        left: { type: JSEPNode.IDENTIFIER, name: 'col1' },
        right: { type: JSEPNode.LITERAL, value: '' },
      };
      const result = await binaryExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        knex: mockKnex,
        columnIdToUidt,
        aliasToColumn,
        model: mockModel,
      });
      expect(result!.builder.toQuery()).to.equal('"col1" IS NULL ');
    });

    it('should handle date comparison with invalid date string for pg client', async () => {
      columnIdToUidt = { col1: UITypes.Date };
      mockFn.callsFake(async (arg: any) => ({
        builder: { toQuery: () => `"${arg.name}"` },
      }));
      const pt = {
        type: JSEPNode.BINARY_EXP,
        operator: '=',
        left: { type: JSEPNode.IDENTIFIER, name: 'col1' },
        right: { type: JSEPNode.LITERAL, value: 'not-a-date' },
      };
      const result = await binaryExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        knex: mockKnex,
        columnIdToUidt,
        aliasToColumn,
        model: mockModel,
      });
      expect(result!.builder.toQuery()).to.equal('"col1" IS NOT NULL ');
    });

    it('should handle CONCAT arguments with COALESCE for sqlite3', async () => {
      (mockKnex.clientType as sinon.SinonStub).returns('sqlite3');
      mockFn.callsFake(async (arg: any) => ({
        builder: {
          toQuery: () => {
            if (
              (arg as ParsedFormulaNode).type === JSEPNode.CALL_EXP &&
              ((arg as ParsedFormulaNode).callee as any).name === 'CONCAT'
            ) {
              return `CONCAT_MOCK(${
                ((arg as ParsedFormulaNode).arguments as ParsedFormulaNode[])[0]
                  .name
              })`;
            }
            return `"${(arg as ParsedFormulaNode).name}"`;
          },
        },
      }));

      const pt = {
        type: JSEPNode.BINARY_EXP,
        operator: '=',
        left: {
          type: JSEPNode.CALL_EXP,
          callee: { type: 'Identifier', name: 'CONCAT' },
          arguments: [{ type: JSEPNode.IDENTIFIER, name: 'leftStr' }],
          fnName: 'CONCAT',
        },
        right: {
          type: JSEPNode.CALL_EXP,
          callee: { type: 'Identifier', name: 'CONCAT' },
          arguments: [{ type: JSEPNode.IDENTIFIER, name: 'rightStr' }],
          fnName: 'CONCAT',
        },
      };
      const result = await binaryExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        knex: mockKnex,
        columnIdToUidt,
        aliasToColumn,
        model: mockModel,
      });
      expect(result!.builder.toQuery()).to.equal(
        `COALESCE(FORMATTED("leftStr"), '') = COALESCE(FORMATTED("rightStr"),'')`,
      );
      expect(convertDateFormatForConcatStub).to.have.been.calledTwice;
    });

    it('should wrap with IFNULL for mysql2', async () => {
      (mockKnex.clientType as sinon.SinonStub).returns('mysql2');
      mockFn.callsFake(async (arg: any) => ({
        builder: { toQuery: () => `"${arg.name}"` },
      }));
      const pt = {
        type: JSEPNode.BINARY_EXP,
        operator: '=',
        left: { type: JSEPNode.IDENTIFIER, name: 'val1' },
        right: { type: JSEPNode.IDENTIFIER, name: 'val2' },
      };
      const result = await binaryExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        knex: mockKnex,
        columnIdToUidt,
        aliasToColumn,
        model: mockModel,
      });
      expect(result!.builder.toQuery()).to.equal(`IFNULL("val1" = "val2", 0)`);
    });

    it('should handle = with empty string literal for sqlite3/pg', async () => {
      (mockKnex.clientType as sinon.SinonStub).returns('pg');
      mockFn.callsFake(async (arg: any) => ({
        builder: { toQuery: () => `"${arg.name}"` },
      }));
      const pt = {
        type: JSEPNode.BINARY_EXP,
        operator: '=',
        left: { type: JSEPNode.IDENTIFIER, name: 'textCol' },
        right: { type: JSEPNode.LITERAL, value: '' },
      };
      const result = await binaryExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        knex: mockKnex,
        columnIdToUidt,
        aliasToColumn,
        model: mockModel,
      });
      expect(result!.builder.toQuery()).to.equal(
        `"textCol" IS NULL OR CAST("textCol" AS TEXT) = ''`,
      );
    });

    it('should handle != with empty string literal for sqlite3/pg', async () => {
      (mockKnex.clientType as sinon.SinonStub).returns('pg');
      mockFn.callsFake(async (arg: any) => ({
        builder: { toQuery: () => `"${arg.name}"` },
      }));
      const pt = {
        type: JSEPNode.BINARY_EXP,
        operator: '!=',
        left: { type: JSEPNode.IDENTIFIER, name: 'textCol' },
        right: { type: JSEPNode.LITERAL, value: '' },
      };
      const result = await binaryExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        knex: mockKnex,
        columnIdToUidt,
        aliasToColumn,
        model: mockModel,
      });
      expect(result!.builder.toQuery()).to.equal(
        `"textCol" IS NOT NULL AND CAST("textCol" AS TEXT) != ''`,
      );
    });

    it('should wrap comparison with CASE WHEN for sqlite3/pg if not AND/OR', async () => {
      (mockKnex.clientType as sinon.SinonStub).returns('pg');
      mockFn.callsFake(async (arg: any) => ({
        builder: { toQuery: () => `"${arg.name}"` },
      }));
      const pt = {
        type: JSEPNode.BINARY_EXP,
        operator: '=',
        left: { type: JSEPNode.IDENTIFIER, name: 'val1' },
        right: { type: JSEPNode.IDENTIFIER, name: 'val2' },
      };
      const result = await binaryExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        knex: mockKnex,
        columnIdToUidt,
        aliasToColumn,
        model: mockModel,
      });
      expect(result!.builder.toQuery()).to.equal(
        `(CASE WHEN "val1" = "val2" THEN true ELSE false END )`,
      );
    });

    it('should handle divide by zero with NULLIF for sqlite3/pg', async () => {
      (mockKnex.clientType as sinon.SinonStub).returns('pg');
      mockFn.callsFake(async (arg: any) => ({
        builder: { toQuery: () => `"${arg.name}"` },
      }));
      const pt = {
        type: JSEPNode.BINARY_EXP,
        operator: '/',
        left: { type: JSEPNode.IDENTIFIER, name: 'num1' },
        right: { type: JSEPNode.IDENTIFIER, name: 'num2' },
      };
      const result = await binaryExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '',
        knex: mockKnex,
        columnIdToUidt,
        aliasToColumn,
        model: mockModel,
      });
      expect(result!.builder.toQuery()).to.equal(
        `"num1" / NULLIF("num2", '0')`,
      );
    });

    it('should wrap expression in parentheses if prevBinaryOp is different', async () => {
      mockFn.callsFake(async (arg: any) => ({
        builder: { toQuery: () => `"${arg.name}"` },
      }));
      const pt = {
        type: JSEPNode.BINARY_EXP,
        operator: '+',
        left: { type: JSEPNode.IDENTIFIER, name: 'val1' },
        right: { type: JSEPNode.IDENTIFIER, name: 'val2' },
      };
      const result = await binaryExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '*',
        knex: mockKnex,
        columnIdToUidt,
        aliasToColumn,
        model: mockModel,
      });
      expect(result!.builder.toQuery()).to.equal(`("val1" + "val2")`);
    });

    it('should not wrap expression in parentheses if prevBinaryOp is same', async () => {
      mockFn.callsFake(async (arg: any) => ({
        builder: { toQuery: () => `"${arg.name}"` },
      }));
      const pt = {
        type: JSEPNode.BINARY_EXP,
        operator: '+',
        left: { type: JSEPNode.IDENTIFIER, name: 'val1' },
        right: { type: JSEPNode.IDENTIFIER, name: 'val2' },
      };
      const result = await binaryExpressionBuilder({
        context: mockContext,
        pt: pt as any,
        fn: mockFn,
        prevBinaryOp: '+',
        knex: mockKnex,
        columnIdToUidt,
        aliasToColumn,
        model: mockModel,
      });
      expect(result!.builder.toQuery()).to.equal(`"val1" + "val2"`);
    });
  });
}

export function formulaParsedTreeBuilderTest() {
  describe.only('FormulaParsedTreeBuilderTests', formulaParsedTreeBuilderTests);
}
