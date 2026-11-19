import { extractCallExpressionReferencedInfo } from './referenced-info-extractor';
import { FormulaDataTypes, JSEPNode } from './enums';
import UITypes from '../UITypes';
import type {
  CallExpressionNode,
  IdentifierNode,
  LiteralNode,
  ParsedFormulaNode,
} from './types';

const lookupArg = (id: string, uidt: UITypes): IdentifierNode => ({
  type: JSEPNode.IDENTIFIER,
  name: id,
  raw: id,
  dataType: FormulaDataTypes.STRING,
  isDataArray: true,
  referencedColumn: {
    id,
    uidt,
    intermediaryUidt: UITypes.Lookup,
    intermediaryId: `${id}_lookup`,
  },
});

const textLiteral: LiteralNode = {
  type: JSEPNode.LITERAL,
  value: 'x',
  raw: '"x"',
  dataType: FormulaDataTypes.STRING,
};

const call = (name: string, args: ParsedFormulaNode[]): CallExpressionNode => ({
  type: JSEPNode.CALL_EXP,
  callee: { type: JSEPNode.IDENTIFIER, name },
  arguments: args,
  dataType: FormulaDataTypes.ARRAY,
});

describe('extractCallExpressionReferencedInfo: ARRAYFLATTEN', () => {
  const owner = lookupArg('colOwner', UITypes.User);
  const tags = lookupArg('colTags', UITypes.SingleLineText);
  const files = lookupArg('colFiles', UITypes.Attachment);

  it('keeps the display of a single array argument', () => {
    const info = extractCallExpressionReferencedInfo({
      parsedTree: call('ARRAYFLATTEN', [owner]),
    });
    expect(info.referencedColumn).toMatchObject({
      id: 'colOwner',
      uidt: UITypes.User,
    });
    expect(info.invalidForReferenceColumn).toBe(false);
  });

  it('keeps the display when every argument is the same field', () => {
    const info = extractCallExpressionReferencedInfo({
      parsedTree: call('ARRAYFLATTEN', [files, files]),
    });
    expect(info.referencedColumn).toMatchObject({
      id: 'colFiles',
      uidt: UITypes.Attachment,
    });
  });

  it.each([
    ['a User lookup and a text lookup', [owner, tags]],
    ['a text lookup and a User lookup', [tags, owner]],
    ['two fields of different types', [files, tags]],
    ['two different User fields', [owner, lookupArg('colOther', UITypes.User)]],
    ['a field and a literal', [owner, textLiteral]],
  ])('falls back to text for %s', (_label, args) => {
    const info = extractCallExpressionReferencedInfo({
      parsedTree: call('ARRAYFLATTEN', args),
    });
    expect(info.referencedColumn).toBeUndefined();
    expect(info.invalidForReferenceColumn).toBe(true);
    expect(info.uidtCandidates).toEqual([UITypes.SingleLineText]);
  });
});
