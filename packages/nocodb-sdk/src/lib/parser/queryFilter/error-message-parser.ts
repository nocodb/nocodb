import { ILexingError, IRecognitionException } from 'chevrotain';

export const parseLexingError = (e: ILexingError) => {
  console.log(e);
  return e.message;
};

export const parseParsingError = (e: IRecognitionException) => {
  if (e.message.toLowerCase().startsWith('expecting token of type --> ')) {
    const operatorRegex =
      /^Expecting token of type --> ([^\s]+) <-- but found --> '?([^\s']+)'? <--.?/i;
    const tokens = e.message.match(operatorRegex);
    const [expectation, found] = tokens.slice(1, 3);
    switch (expectation) {
      case 'OPERATOR': {
        return `Invalid filter expression: '${found}' is not a recognized operator. Please use a valid comparison or logical operator.`;
      }
      default: {
        return `Invalid filter expression: '${found}' is not a valid token`;
      }
    }
  }
  return e.message;
};
