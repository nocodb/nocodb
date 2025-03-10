import { QueryFilterParser } from './query-filter-parser';

describe('query-filter-parser', () => {
  it('will parse eq expression with double quote', async () => {
    const text = `(field1, eq, "hello, 'world")`;
    const expectedParsedCst = {
      is_group: true,
      logical_op: 'and',
      children: [
        {
          is_group: false,
          field: 'field1',
          comparison_op: 'eq',
          value: "hello, 'world",
        },
      ],
    };
    const result = QueryFilterParser.parse(text);
    expect(result.parsedCst).toEqual(expectedParsedCst);
  });
  it('will parse eq expression with single quote', async () => {
    const text = `(field1, eq, 'hello, "world')`;
    const expectedParsedCst = {
      is_group: true,
      logical_op: 'and',
      children: [
        {
          is_group: false,
          field: 'field1',
          comparison_op: 'eq',
          value: 'hello, "world',
        },
      ],
    };
    const result = QueryFilterParser.parse(text);
    expect(result.parsedCst).toEqual(expectedParsedCst);
  });
  it('will parse eq expression with mandarin, japanese and cryillic', async () => {
    const text = `(Тест, eq, "新年快乐おはよう")`;
    const expectedParsedCst = {
      is_group: true,
      logical_op: 'and',
      children: [
        {
          is_group: false,
          field: 'Тест',
          comparison_op: 'eq',
          value: '新年快乐おはよう',
        },
      ],
    };
    const result = QueryFilterParser.parse(text);
    expect(result.parsedCst).toEqual(expectedParsedCst);
  });
  it('will parse wrong expression', async () => {
    const text = '(field1)';
    const result = QueryFilterParser.parse(text);
    expect(result.parseErrors.length).toBeGreaterThan(0);
  });
  it('will parse blank expression', async () => {
    const text = '(field1, blank)';
    const result = QueryFilterParser.parse(text);
    const expectedParsedCst = {
      is_group: true,
      logical_op: 'and',
      children: [
        {
          is_group: false,
          field: 'field1',
          comparison_op: 'blank',
        },
      ],
    };
    expect(result.parsedCst).toEqual(expectedParsedCst);
  });
  it('will parse blank value', async () => {
    const text = '(Category,gb_eq,)';
    const result = QueryFilterParser.parse(text);
    const expectedParsedCst = {
      is_group: true,
      logical_op: 'and',
      children: [
        {
          is_group: false,
          field: 'Category',
          comparison_op: 'gb_eq',
          value: '',
        },
      ],
    };
    expect(result.parsedCst).toEqual(expectedParsedCst);
  });
  it('will parse value and field with parentheses', async () => {
    const text = '("field(1)",eq,"(hello)")';
    const result = QueryFilterParser.parse(text);
    const expectedParsedCst = {
      is_group: true,
      logical_op: 'and',
      children: [
        {
          is_group: false,
          field: 'field(1)',
          comparison_op: 'eq',
          value: '(hello)',
        },
      ],
    };
    expect(result.parsedCst).toEqual(expectedParsedCst);
  });
  it('will parse value separated by comma', async () => {
    const text = '("field(1)",eq, hello, world,  baby!)';
    const result = QueryFilterParser.parse(text);
    const expectedParsedCst = {
      is_group: true,
      logical_op: 'and',
      children: [
        {
          is_group: false,
          field: 'field(1)',
          comparison_op: 'eq',
          value: 'hello,world,baby!',
        },
      ],
    };
    expect(result.parsedCst).toEqual(expectedParsedCst);
  });
  it('will parse complex nested logic', async () => {
    const text =
      '~not(field1, isWithin, nextNumberOfDays, 10)~and((field2, eq, 2)~or(field2, eq, 3))~or(field3, not, 4)';
    const result = QueryFilterParser.parse(text);
    const expectedParsedCst = {
      is_group: true,
      logical_op: 'and',
      children: [
        {
          is_group: false,
          field: 'field1',
          comparison_op: 'isWithin',
          logical_op: 'not',
          comparison_sub_op: undefined,
          value: ['nextNumberOfDays', '10'],
        },
        {
          is_group: true,
          logical_op: 'and',
          children: [
            {
              is_group: false,
              field: 'field2',
              comparison_op: 'eq',
              value: '2',
            },
            {
              is_group: false,
              field: 'field2',
              comparison_op: 'eq',
              logical_op: 'or',
              value: '3',
            },
          ],
        },
        {
          is_group: false,
          field: 'field3',
          comparison_op: 'not',
          logical_op: 'or',
          value: '4',
        },
      ],
    };
    expect(result.parsedCst).toEqual(expectedParsedCst);
  });
  it('will parse keyword as value', async () => {
    const text = '(Category,is,blank)';
    const result = QueryFilterParser.parse(text);
    const expectedParsedCst = {
      is_group: true,
      logical_op: 'and',
      children: [
        {
          is_group: false,
          field: 'Category',
          comparison_op: 'blank',
          value: undefined,
        },
      ],
    };
    expect(result.parsedCst).toEqual(expectedParsedCst);
  });
  it('will parse empty quote as value', async () => {
    const text = "(Category,eq,'')";
    const result = QueryFilterParser.parse(text);
    const expectedParsedCst = {
      is_group: true,
      logical_op: 'and',
      children: [
        {
          is_group: false,
          field: 'Category',
          comparison_op: 'eq',
          value: '',
        },
      ],
    };
    expect(result.parsedCst).toEqual(expectedParsedCst);
  });
  it('will parse null as null', async () => {
    const text = '("field(1)",eq, null)';
    const result = QueryFilterParser.parse(text);
    const expectedParsedCst = {
      is_group: true,
      logical_op: 'and',
      children: [
        {
          is_group: false,
          field: 'field(1)',
          comparison_op: 'eq',
          value: null,
        },
      ],
    };
    expect(result.parsedCst).toEqual(expectedParsedCst);
  });
  it('will parse empty string as empty', async () => {
    const text = `("field(1)",eq,'')`;
    const result = QueryFilterParser.parse(text);
    const expectedParsedCst = {
      is_group: true,
      logical_op: 'and',
      children: [
        {
          is_group: false,
          field: 'field(1)',
          comparison_op: 'eq',
          value: '',
        },
      ],
    };
    expect(result.parsedCst).toEqual(expectedParsedCst);
  });
});
