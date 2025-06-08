import { ILexingError, IRecognitionException } from 'chevrotain';

export const parseLexingError = (e: ILexingError) => {
  return `Lexing error: ${e.message}, please contact support`;
};

export const parseParsingError = (e: IRecognitionException) => {
  try {
    if (e.message.toLowerCase().startsWith('expecting token of type --> ')) {
      const operatorRegex =
        /^Expecting token of type --> (\S+) <-- but found --> '?([^\s']*)'? <--.?/i;
      const tokens = e.message.match(operatorRegex);
      const [expectation, found] = tokens.slice(1, 3);
      switch (expectation) {
        case 'OPERATOR': {
          return `Invalid filter expression: '${found}' is not a recognized operator. Please use a valid comparison or logical operator`;
        }
        case 'PAREN_END': {
          return `Invalid filter syntax: expected a closing parentheses ')', but found '${found}'`;
        }
        default: {
          return `Invalid filter expression: '${found}' is not a valid token`;
        }
      }
    } else if (
      e.message
        .toLowerCase()
        .startsWith('expecting: one of these possible token sequences:')
    ) {
      const optionRegex = /^\s*\d+\.\s*\[(.+)\]/im;
      const foundRegex = /but found: '?([^\s']+)'?/im;
      const messageParts = e.message.split('\n');
      const options = messageParts
        .slice(1, messageParts.length - 1)
        .map((t) => t.match(optionRegex)[1]);
      const found = messageParts
        .slice(messageParts.length - 1)[0]
        .match(foundRegex)[1];
      if (
        e.token?.tokenType?.name === 'IDENTIFIER' &&
        options.some((k) => k === 'IDENTIFIER, COMMA')
      ) {
        return `Invalid filter syntax: expected comma ',' followed with operator (and value) after field`;
      }
      if (options.some((k) => k === 'NOT_OPERATOR' || k === 'PAREN_START')) {
        return `Invalid filter syntax: expected a logical operator like '~not' or opening parenthesis, but found '${found}'`;
      }
    }
  } catch {
    // silent catch
  }
  return e.message;
};
