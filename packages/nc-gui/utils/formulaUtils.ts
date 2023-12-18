import type { Input as AntInput } from 'ant-design-vue'

enum formulaTypes {
  NUMERIC = 'numeric',
  STRING = 'string',
  DATE = 'date',
  LOGICAL = 'logical',
  COND_EXP = 'conditional_expression',
  NULL = 'null',
  BOOLEAN = 'boolean',
}

interface FormulaMeta {
  type?: string
  validation?: {
    args?: {
      min?: number
      max?: number
      rqd?: number
    }
  }
  description?: string
  syntax?: string
  examples?: string[]
  returnType?: ((args: any[]) => formulaTypes) | formulaTypes
}

const formulas: Record<string, FormulaMeta> = {
  AVG: {
    type: formulaTypes.NUMERIC,
    validation: {
      args: {
        min: 1,
      },
    },
    description: 'Average of input parameters',
    syntax: 'AVG(value1, [value2, ...])',
    examples: ['AVG(10, 5) => 7.5', 'AVG({column1}, {column2})', 'AVG({column1}, {column2}, {column3})'],
    returnType: formulaTypes.NUMERIC,
  },
  ADD: {
    type: formulaTypes.NUMERIC,
    validation: {
      args: {
        min: 1,
      },
    },
    description: 'Sum of input parameters',
    syntax: 'ADD(value1, [value2, ...])',
    examples: ['ADD(5, 5) => 10', 'ADD({column1}, {column2})', 'ADD({column1}, {column2}, {column3})'],
    returnType: formulaTypes.NUMERIC,
  },
  DATEADD: {
    type: formulaTypes.DATE,
    validation: {
      args: {
        rqd: 3,
      },
    },
    description: 'Adds a "count" units to Datetime.',
    syntax: 'DATEADD(date | datetime, value, ["day" | "week" | "month" | "year"])',
    examples: [
      'DATEADD({column1}, 2, "day")',
      'DATEADD({column1}, -2, "day")',
      'DATEADD({column1}, 2, "week")',
      'DATEADD({column1}, -2, "week")',
      'DATEADD({column1}, 2, "month")',
      'DATEADD({column1}, -2, "month")',
      'DATEADD({column1}, 2, "year")',
      'DATEADD({column1}, -2, "year")',
    ],
    returnType: formulaTypes.DATE,
  },
  DATETIME_DIFF: {
    type: formulaTypes.DATE,
    validation: {
      args: {
        min: 2,
        max: 3,
      },
    },
    description: 'Calculate the difference of two given date / datetime in specified units.',
    syntax:
      'DATETIME_DIFF(date | datetime, date | datetime, ["milliseconds" | "ms" | "seconds" | "s" | "minutes" | "m" | "hours" | "h" | "days" | "d" | "weeks" | "w" | "months" | "M" | "quarters" | "Q" | "years" | "y"])',
    examples: [
      'DATEDIFF({column1}, {column2})',
      'DATEDIFF({column1}, {column2}, "seconds")',
      'DATEDIFF({column1}, {column2}, "s")',
      'DATEDIFF({column1}, {column2}, "years")',
      'DATEDIFF({column1}, {column2}, "y")',
      'DATEDIFF({column1}, {column2}, "minutes")',
      'DATEDIFF({column1}, {column2}, "m")',
      'DATEDIFF({column1}, {column2}, "days")',
      'DATEDIFF({column1}, {column2}, "d")',
    ],
    returnType: formulaTypes.NUMERIC,
  },
  AND: {
    type: formulaTypes.COND_EXP,
    validation: {
      args: {
        min: 1,
      },
    },
    description: 'TRUE if all expr evaluate to TRUE',
    syntax: 'AND(expr1, [expr2, ...])',
    examples: ['AND(5 > 2, 5 < 10) => 1', 'AND({column1} > 2, {column2} < 10)'],
    returnType: formulaTypes.COND_EXP,
  },
  OR: {
    type: formulaTypes.COND_EXP,
    validation: {
      args: {
        min: 1,
      },
    },
    description: 'TRUE if at least one expr evaluates to TRUE',
    syntax: 'OR(expr1, [expr2, ...])',
    examples: ['OR(5 > 2, 5 < 10) => 1', 'OR({column1} > 2, {column2} < 10)'],
    returnType: formulaTypes.COND_EXP,
  },
  CONCAT: {
    type: formulaTypes.STRING,
    validation: {
      args: {
        min: 1,
      },
    },
    description: 'Concatenated string of input parameters',
    syntax: 'CONCAT(str1, [str2, ...])',
    examples: ['CONCAT("AA", "BB", "CC") => "AABBCC"', 'CONCAT({column1}, {column2}, {column3})'],
    returnType: formulaTypes.STRING,
  },
  TRIM: {
    type: formulaTypes.STRING,
    validation: {
      args: {
        rqd: 1,
      },
    },
    description: 'Remove trailing and leading whitespaces from input parameter',
    syntax: 'TRIM(str)',
    examples: ['TRIM("         HELLO WORLD  ") => "HELLO WORLD"', 'TRIM({column1})'],
    returnType: formulaTypes.STRING,
  },
  UPPER: {
    type: formulaTypes.STRING,
    validation: {
      args: {
        rqd: 1,
      },
    },
    description: 'Upper case converted string of input parameter',
    syntax: 'UPPER(str)',
    examples: ['UPPER("nocodb") => "NOCODB"', 'UPPER({column1})'],
    returnType: formulaTypes.STRING,
  },
  LOWER: {
    type: formulaTypes.STRING,
    validation: {
      args: {
        rqd: 1,
      },
    },
    description: 'Lower case converted string of input parameter',
    syntax: 'LOWER(str)',
    examples: ['LOWER("NOCODB") => "nocodb"', 'LOWER({column1})'],
    returnType: formulaTypes.STRING,
  },
  LEN: {
    type: formulaTypes.STRING,
    validation: {
      args: {
        rqd: 1,
      },
    },
    description: 'Input parameter character length',
    syntax: 'LEN(value)',
    examples: ['LEN("NocoDB") => 6', 'LEN({column1})'],
    returnType: formulaTypes.NUMERIC,
  },
  MIN: {
    type: formulaTypes.NUMERIC,
    validation: {
      args: {
        min: 1,
      },
    },
    description: 'Minimum value amongst input parameters',
    syntax: 'MIN(value1, [value2, ...])',
    examples: ['MIN(1000, 2000) => 1000', 'MIN({column1}, {column2})'],
    returnType: formulaTypes.NUMERIC,
  },
  MAX: {
    type: formulaTypes.NUMERIC,
    validation: {
      args: {
        min: 1,
      },
    },
    description: 'Maximum value amongst input parameters',
    syntax: 'MAX(value1, [value2, ...])',
    examples: ['MAX(1000, 2000) => 2000', 'MAX({column1}, {column2})'],
    returnType: formulaTypes.NUMERIC,
  },
  CEILING: {
    type: formulaTypes.NUMERIC,
    validation: {
      args: {
        rqd: 1,
      },
    },
    description: 'Rounded next largest integer value of input parameter',
    syntax: 'CEILING(value)',
    examples: ['CEILING(1.01) => 2', 'CEILING({column1})'],
    returnType: formulaTypes.NUMERIC,
  },
  FLOOR: {
    type: formulaTypes.NUMERIC,
    validation: {
      args: {
        rqd: 1,
      },
    },
    description: 'Rounded largest integer less than or equal to input parameter',
    syntax: 'FLOOR(value)',
    examples: ['FLOOR(3.1415) => 3', 'FLOOR({column1})'],
    returnType: formulaTypes.NUMERIC,
  },
  ROUND: {
    type: formulaTypes.NUMERIC,
    validation: {
      args: {
        min: 1,
        max: 2,
      },
    },
    description: 'Rounded number to a specified number of decimal places or the nearest integer if not specified',
    syntax: 'ROUND(value, precision), ROUND(value)',
    examples: ['ROUND(3.1415) => 3', 'ROUND(3.1415, 2) => 3.14', 'ROUND({column1}, 3)'],
    returnType: formulaTypes.NUMERIC,
  },
  MOD: {
    type: formulaTypes.NUMERIC,
    validation: {
      args: {
        rqd: 2,
      },
    },
    description: 'Remainder after integer division of input parameters',
    syntax: 'MOD(value1, value2)',
    examples: ['MOD(1024, 1000) => 24', 'MOD({column}, 2)'],
    returnType: formulaTypes.NUMERIC,
  },
  REPEAT: {
    type: formulaTypes.STRING,
    validation: {
      args: {
        rqd: 2,
      },
    },
    description: 'Specified copies of the input parameter string concatenated together',
    syntax: 'REPEAT(str, count)',
    examples: ['REPEAT("A", 5) => "AAAAA"', 'REPEAT({column}, 5)'],
    returnType: formulaTypes.STRING,
  },
  LOG: {
    type: formulaTypes.NUMERIC,
    validation: {},
    description: 'Logarithm of input parameter to the base (default = e) specified',
    syntax: 'LOG([base], value)',
    examples: ['LOG(2, 1024) => 10', 'LOG(2, {column1})'],
    returnType: formulaTypes.NUMERIC,
  },
  EXP: {
    type: formulaTypes.NUMERIC,
    validation: {},
    description: 'Exponential value of input parameter (e ^ power)',
    syntax: 'EXP(power)',
    examples: ['EXP(1) => 2.718281828459045', 'EXP({column1})'],
    returnType: formulaTypes.NUMERIC,
  },
  POWER: {
    type: formulaTypes.NUMERIC,
    validation: {
      args: {
        rqd: 2,
      },
    },
    description: 'base to the exponent power, as in base ^ exponent',
    syntax: 'POWER(base, exponent)',
    examples: ['POWER(2, 10) => 1024', 'POWER({column1}, 10)'],
    returnType: formulaTypes.NUMERIC,
  },
  SQRT: {
    type: formulaTypes.NUMERIC,
    validation: {
      args: {
        rqd: 1,
      },
    },
    description: 'Square root of the input parameter',
    syntax: 'SQRT(value)',
    examples: ['SQRT(100) => 10', 'SQRT({column1})'],
    returnType: formulaTypes.NUMERIC,
  },
  ABS: {
    type: formulaTypes.NUMERIC,
    validation: {
      args: {
        rqd: 1,
      },
    },
    description: 'Absolute value of the input parameter',
    syntax: 'ABS(value)',
    examples: ['ABS({column1})'],
    returnType: formulaTypes.NUMERIC,
  },
  NOW: {
    type: formulaTypes.DATE,
    validation: {
      args: {
        rqd: 0,
      },
    },
    description: 'Returns the current time and day',
    syntax: 'NOW()',
    examples: ['NOW() => 2022-05-19 17:20:43'],
    returnType: formulaTypes.DATE,
  },
  REPLACE: {
    type: formulaTypes.STRING,
    validation: {
      args: {
        rqd: 3,
      },
    },
    description: 'String, after replacing all occurrences of srchStr with rplcStr',
    syntax: 'REPLACE(str, srchStr, rplcStr)',
    examples: ['REPLACE("AABBCC", "AA", "BB") => "BBBBCC"', 'REPLACE({column1}, {column2}, {column3})'],
    returnType: formulaTypes.STRING,
  },
  SEARCH: {
    type: formulaTypes.STRING,
    validation: {
      args: {
        rqd: 2,
      },
    },
    description: 'Index of srchStr specified if found, 0 otherwise',
    syntax: 'SEARCH(str, srchStr)',
    examples: ['SEARCH("HELLO WORLD", "WORLD") => 7', 'SEARCH({column1}, "abc")'],
    returnType: formulaTypes.NUMERIC,
  },
  INT: {
    type: formulaTypes.NUMERIC,
    validation: {
      args: {
        rqd: 1,
      },
    },
    description: 'Integer value of input parameter',
    syntax: 'INT(value)',
    examples: ['INT(3.1415) => 3', 'INT({column1})'],
    returnType: formulaTypes.NUMERIC,
  },
  RIGHT: {
    type: formulaTypes.STRING,
    validation: {
      args: {
        rqd: 2,
      },
    },
    description: 'n characters from the end of input parameter',
    syntax: 'RIGHT(str, n)',
    examples: ['RIGHT("HELLO WORLD", 5) => WORLD', 'RIGHT({column1}, 3)'],
    returnType: formulaTypes.STRING,
  },
  LEFT: {
    type: formulaTypes.STRING,
    validation: {
      args: {
        rqd: 2,
      },
    },
    description: 'n characters from the beginning of input parameter',
    syntax: 'LEFT(str, n)',
    examples: ['LEFT({column1}, 2)', 'LEFT("ABCD", 2) => "AB"'],
    returnType: formulaTypes.STRING,
  },
  SUBSTR: {
    type: formulaTypes.STRING,
    validation: {
      args: {
        min: 2,
        max: 3,
      },
    },
    description: 'Substring of length n of input string from the postition specified',
    syntax: '	SUBTR(str, position, [n])',
    examples: ['SUBSTR("HELLO WORLD", 7) => WORLD', 'SUBSTR("HELLO WORLD", 7, 3) => WOR', 'SUBSTR({column1}, 7, 5)'],
    returnType: formulaTypes.STRING,
  },
  MID: {
    type: formulaTypes.STRING,
    validation: {
      args: {
        rqd: 3,
      },
    },
    description: 'Alias for SUBSTR',
    syntax: 'MID(str, position, [count])',
    examples: ['MID("NocoDB", 3, 2) => "co"', 'MID({column1}, 3, 2)'],
    returnType: formulaTypes.STRING,
  },
  IF: {
    type: formulaTypes.COND_EXP,
    validation: {
      args: {
        min: 2,
        max: 3,
      },
    },
    description: 'SuccessCase if expr evaluates to TRUE, elseCase otherwise',
    syntax: 'IF(expr, successCase, elseCase)',
    examples: ['IF(5 > 1, "YES", "NO") => "YES"', 'IF({column} > 1, "YES", "NO")'],
    returnType: (argsTypes: formulaTypes[]) => {
      if (argsTypes.slice(1).includes(formulaTypes.STRING)) {
        return formulaTypes.STRING
      } else if (argsTypes.slice(1).includes(formulaTypes.NUMERIC)) {
        return formulaTypes.NUMERIC
      } else if (argsTypes.slice(1).includes(formulaTypes.BOOLEAN)) {
        return formulaTypes.BOOLEAN
      }

      return argsTypes[1]
    },
  },
  SWITCH: {
    type: formulaTypes.COND_EXP,
    validation: {
      args: {
        min: 3,
      },
    },
    description: 'Switch case value based on expr output',
    syntax: 'SWITCH(expr, [pattern, value, ..., default])',
    examples: [
      'SWITCH(1, 1, "One", 2, "Two", "N/A") => "One""',
      'SWITCH(2, 1, "One", 2, "Two", "N/A") => "Two"',
      'SWITCH(3, 1, "One", 2, "Two", "N/A") => "N/A"',
      'SWITCH({column1}, 1, "One", 2, "Two", "N/A")',
    ],
    // todo: resolve return type based on the args
    returnType: (argTypes: formulaTypes[]) => {
      return formulaTypes.STRING
    },
  },
  URL: {
    type: formulaTypes.STRING,
    validation: {
      args: {
        rqd: 1,
      },
    },
    description: 'Convert to a hyperlink if it is a valid URL',
    syntax: 'URL(str)',
    examples: ['URL("https://github.com/nocodb/nocodb")', 'URL({column1})'],
    returnType: formulaTypes.STRING,
  },
  WEEKDAY: {
    type: formulaTypes.NUMERIC,
    validation: {
      args: {
        min: 1,
        max: 2,
      },
    },
    description: 'Returns the day of the week as an integer between 0 and 6 inclusive starting from Monday by default',
    syntax: 'WEEKDAY(date, [startDayOfWeek])',
    examples: ['WEEKDAY("2021-06-09")', 'WEEKDAY(NOW(), "sunday")'],
    returnType: formulaTypes.NUMERIC,
  },

  TRUE: {
    type: formulaTypes.NUMERIC,
    validation: {
      args: {
        max: 0,
      },
    },
    description: 'Returns 1',
    syntax: 'TRUE()',
    examples: ['TRUE()'],
    returnType: formulaTypes.NUMERIC,
  },

  FALSE: {
    type: formulaTypes.NUMERIC,
    validation: {
      args: {
        max: 0,
      },
    },
    description: 'Returns 0',
    syntax: 'FALSE()',
    examples: ['FALSE()'],
    returnType: formulaTypes.NUMERIC,
  },

  REGEX_MATCH: {
    type: formulaTypes.STRING,
    validation: {
      args: {
        rqd: 2,
      },
    },
    description: 'Returns 1 if the input text matches a regular expression or 0 if it does not.',
    syntax: 'REGEX_MATCH(string, regex)',
    examples: ['REGEX_MATCH({title}, "abc.*")'],
    returnType: formulaTypes.NUMERIC,
  },

  REGEX_EXTRACT: {
    type: formulaTypes.STRING,
    validation: {
      args: {
        rqd: 2,
      },
    },
    description: 'Returns the first match of a regular expression in a string.',
    syntax: 'REGEX_EXTRACT(string, regex)',
    examples: ['REGEX_EXTRACT({title}, "abc.*")'],
    returnType: formulaTypes.STRING,
  },
  REGEX_REPLACE: {
    type: formulaTypes.STRING,
    validation: {
      args: {
        rqd: 3,
      },
    },
    description: 'Replaces all matches of a regular expression in a string with a replacement string',
    syntax: 'REGEX_MATCH(string, regex, replacement)',
    examples: ['REGEX_EXTRACT({title}, "abc.*", "abcd")'],
    returnType: formulaTypes.STRING,
  },
  BLANK: {
    type: formulaTypes.STRING,
    validation: {
      args: {
        rqd: 0,
      },
    },
    description: 'Returns a blank value(null)',
    syntax: 'BLANK()',
    examples: ['BLANK()'],
    returnType: formulaTypes.NULL,
  },
  XOR: {
    type: formulaTypes.NUMERIC,
    validation: {
      args: {
        min: 1,
      },
    },
    description: 'Returns true if an odd number of arguments are true, and false otherwise.',
    syntax: 'XOR(expression, [exp2, ...])',
    examples: ['XOR(TRUE(), FALSE(), TRUE())'],
    returnType: formulaTypes.BOOLEAN,
  },
  EVEN: {
    type: formulaTypes.NUMERIC,
    validation: {
      args: {
        rqd: 1,
      },
    },
    description: 'Returns the nearest even integer that is greater than or equal to the specified value',
    syntax: 'EVEN(value)',
    examples: ['EVEN({column})'],
    returnType: formulaTypes.NUMERIC,
  },
  ODD: {
    type: formulaTypes.NUMERIC,
    validation: {
      args: {
        rqd: 1,
      },
    },
    description: 'Returns the nearest odd integer that is greater than or equal to the specified value',
    syntax: 'ODD(value)',
    examples: ['ODD({column})'],
    returnType: formulaTypes.NUMERIC,
  },
  RECORD_ID: {
    validation: {
      args: {
        rqd: 0,
      },
    },
    description: 'Returns the record id of the current record',
    syntax: 'RECORD_ID()',
    examples: ['RECORD_ID()'],

    // todo: resolve return type based on the args
    returnType: () => {
      return formulaTypes.STRING
    },
  },
  COUNTA: {
    validation: {
      args: {
        min: 1,
      },
    },
    description: 'Counts the number of non-empty arguments',
    syntax: 'COUNTA(value1, [value2, ...])',
    examples: ['COUNTA({field1}, {field2})'],
    returnType: formulaTypes.NUMERIC,
  },
  COUNT: {
    validation: {
      args: {
        min: 1,
      },
    },
    description: 'Count the number of arguments that are numbers',
    syntax: 'COUNT(value1, [value2, ...])',
    examples: ['COUNT({field1}, {field2})'],
    returnType: formulaTypes.NUMERIC,
  },
  COUNTALL: {
    validation: {
      args: {
        min: 1,
      },
    },
    description: 'Counts the number of arguments',
    syntax: 'COUNTALL(value1, [value2, ...])',
    examples: ['COUNTALL({field1}, {field2})'],
    returnType: formulaTypes.NUMERIC,
  },
  ROUNDDOWN: {
    type: formulaTypes.NUMERIC,
    validation: {
      args: {
        min: 1,
        max: 2,
      },
    },
    description:
      'Round down the value after the decimal point to the number of decimal places given by "precision"(default is 0)',
    syntax: 'ROUNDDOWN(value, [precision])',
    examples: ['ROUNDDOWN({field1})', 'ROUNDDOWN({field1}, 2)'],
    returnType: formulaTypes.NUMERIC,
  },
  ROUNDUP: {
    type: formulaTypes.NUMERIC,
    validation: {
      args: {
        min: 1,
        max: 2,
      },
    },
    description: 'Round up the value after the decimal point to the number of decimal places given by "precision"(default is 0)',
    syntax: 'ROUNDUP(value, [precision])',
    examples: ['ROUNDUP({field1})', 'ROUNDUP({field1}, 2)'],
    returnType: formulaTypes.NUMERIC,
  },
  VALUE: {
    validation: {
      args: {
        rqd: 1,
      },
    },
    description:
      'Extract the numeric value from a string, if `%` or `-` is present, it will handle it accordingly and return the numeric value',
    syntax: 'VALUE(value)',
    examples: ['VALUE({field})', 'VALUE("abc10000%")', 'VALUE("$10000")'],
    returnType: formulaTypes.NUMERIC,
  },
  // Disabling these functions for now; these act as alias for CreatedAt & UpdatedAt fields;
  // Issue: Error noticed if CreatedAt & UpdatedAt fields are removed from the table after creating these formulas
  //
  // CREATED_TIME: {
  //   validation: {
  //     args: {
  //       rqd: 0,
  //     },
  //   },
  //   description: 'Returns the created time of the current record if it exists',
  //   syntax: 'CREATED_TIME()',
  //   examples: ['CREATED_TIME()'],
  // },
  // LAST_MODIFIED_TIME: {
  //   validation: {
  //     args: {
  //       rqd: 0,
  //     },
  //   },
  //   description: 'Returns the last modified time of the current record if it exists',
  //   syntax: ' LAST_MODIFIED_TIME()',
  //   examples: [' LAST_MODIFIED_TIME()'],
  // },
}

const formulaList = Object.keys(formulas)

// ref : https://stackoverflow.com/a/11077016
function insertAtCursor(myField: typeof AntInput, myValue: string, len = 0, b = 0) {
  // MOZILLA and others
  if (myField.selectionStart || myField.selectionStart === 0) {
    const startPos = myField.selectionStart
    const endPos = myField.selectionEnd
    myField.value = myField.value.substring(0, startPos - len) + myValue + myField.value.substring(endPos, myField.value.length)
    const pos = +startPos - len + myValue.length - b
    // https://stackoverflow.com/a/4302688
    if (myField.setSelectionRange) {
      myField.focus()
      myField.setSelectionRange(pos, pos)
    } else if (myField.createTextRange) {
      const range = myField.createTextRange()
      range.collapse(true)
      range.moveEnd('character', pos)
      range.moveStart('character', pos)
      range.select()
    }
  } else {
    myField.value += myValue
  }
  return myField.value
}

function ReturnWord(text: string, caretPos: number) {
  const preText = text.substring(0, caretPos)
  if (preText.indexOf(' ') > 0) {
    const words = preText.split(' ')
    return words[words.length - 1] // return last word
  } else {
    return preText
  }
}

function getWordUntilCaret(ctrl: typeof AntInput) {
  const caretPos = GetCaretPosition(ctrl)
  const word = ReturnWord(ctrl.value, caretPos)
  return word || ''
}

function GetCaretPosition(ctrl: typeof AntInput) {
  let CaretPos = 0
  if (ctrl.selectionStart || ctrl.selectionStart === 0) {
    CaretPos = ctrl.selectionStart
  }
  return CaretPos
}

export { formulaList, formulas, formulaTypes, getWordUntilCaret, insertAtCursor }
