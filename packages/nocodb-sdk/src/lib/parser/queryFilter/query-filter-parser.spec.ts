import { QueryFilterParser } from './query-filter-parser';

describe('query-filter-parser', () => {
  it('will parse eq expression with double quote', async () => {
    const text = `(field1, eq, "hello, 'world")`;
    const expectedParsedCst = {
      field: 'field1',
      comparison_op: 'eq',
      value: '"hello, \'world"',
    };
    const result = await QueryFilterParser.parse(text);
    expect(result.parsedCst).toEqual(expectedParsedCst);
  });
  it('will parse eq expression with single quote', async () => {
    const text = `(field1, eq, 'hello, "world')`;
    const expectedParsedCst = {
      field: 'field1',
      comparison_op: 'eq',
      value: "'hello, \"world'",
    };
    const result = await QueryFilterParser.parse(text);
    expect(result.parsedCst).toEqual(expectedParsedCst);
  });
  it('will parse wrong expression', async () => {
    const text = '(field1, hello_world)';
    const result = await QueryFilterParser.parse(text);
    expect(result.parseErrors.length).toBeGreaterThan(0);
  });
  it('will parse suboperator', async () => {
    const text = '(field1, eq, today)';
    const result = await QueryFilterParser.parse(text);
    const expectedParsedCst = {
      field: 'field1',
      comparison_op: 'eq',
      comparison_sub_op: 'today',
    };
    expect(result.parsedCst).toEqual(expectedParsedCst);
  });
  it('will parse suboperator with value', async () => {
    const text = '(field1, isWithin, nextNumberOfDays, 10)';
    const result = await QueryFilterParser.parse(text);
    const expectedParsedCst = {
      field: 'field1',
      comparison_op: 'isWithin',
      comparison_sub_op: 'nextNumberOfDays',
      value: '10',
    };
    expect(result.parsedCst).toEqual(expectedParsedCst);
  });
});
