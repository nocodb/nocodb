import { parseParsingError } from './error-message-parser';
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
  describe('error-handling', () => {
    it(`will error when and/or operation is wrong`, async () => {
      expect.hasAssertions();
      const text = `(fSingleLineText,eq,"sample,text")or(fSingleLineText,eq,"sample text")`;
      try {
        QueryFilterParser.parse(text);
      } catch (ex) {
        expect(ex.message).toBe(
          `Invalid filter expression. Expected a valid logical operator like '~or' or '~and', but found 'or'`
        );
      }
    });
    it(`will handle parsing error when operation is wrong`, async () => {
      const text = `(fSingleLineText,noneInOperation,"sample,text")`;
      const result = QueryFilterParser.parse(text);
      const message = parseParsingError(result.parseErrors[0]);
      expect(message).toBe(
        `Invalid filter expression: 'noneInOperation' is not a recognized operator. Please use a valid comparison or logical operator`
      );
    });
    it(`will handle parsing error when operation is missing`, async () => {
      const text = `(fSingleLineText,)`;
      const result = QueryFilterParser.parse(text);
      const message = parseParsingError(result.parseErrors[0]);
      expect(message).toBe(
        `Invalid filter expression: ')' is not a recognized operator. Please use a valid comparison or logical operator`
      );
    });
    it(`will handle parsing error when operation is wrapped in quotes`, async () => {
      const text = `(fSingleLineText,"eq")`;
      const result = QueryFilterParser.parse(text);
      const message = parseParsingError(result.parseErrors[0]);
      expect(message).toBe(
        `Invalid filter expression: '"eq"' is not a recognized operator. Please use a valid comparison or logical operator`
      );
    });
    it(`will handle parsing error when no opening parentheses`, async () => {
      const text = `fSingleLineText,eq)`;
      const result = QueryFilterParser.parse(text);
      const message = parseParsingError(result.parseErrors[0]);
      expect(message).toBe(
        `Invalid filter syntax: expected a logical operator like '~not' or opening parenthesis, but found 'fSingleLineText'`
      );
    });
    it(`will handle parsing error when no closing parentheses`, async () => {
      const text = `(fSingleLineText,eq`;
      const result = QueryFilterParser.parse(text);
      const message = parseParsingError(result.parseErrors[0]);
      expect(message).toBe(
        `Invalid filter syntax: expected a closing parentheses ')', but found ''`
      );
    });
    it(`will handle parsing error when not operator is wrong`, async () => {
      const text = `not(fSingleLineText,eq,1)`;
      const result = QueryFilterParser.parse(text);
      const message = parseParsingError(result.parseErrors[0]);
      expect(message).toBe(
        `Invalid filter syntax: expected a logical operator like '~not' or opening parenthesis, but found 'not'`
      );
    });
    it(`will handle parsing error when missing comma`, async () => {
      const text = `(fSingleLineText`;
      const result = QueryFilterParser.parse(text);
      const message = parseParsingError(result.parseErrors[0]);
      expect(message).toBe(
        `Invalid filter syntax: expected comma ',' followed with operator (and value) after field`
      );
    });
    it(`will handle parsing error when missing arguments`, async () => {
      const text = `(fSingleLineText)`;
      const result = QueryFilterParser.parse(text);
      const message = parseParsingError(result.parseErrors[0]);
      expect(message).toBe(
        `Invalid filter syntax: expected comma ',' followed with operator (and value) after field`
      );
    });
  });
});
