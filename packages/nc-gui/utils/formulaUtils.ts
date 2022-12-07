import type { Input as AntInput } from 'ant-design-vue'

const formulaTypes = {
  NUMERIC: 'numeric',
  STRING: 'string',
  DATE: 'date',
  LOGICAL: 'logical',
  COND_EXP: 'conditional_expression',
}

const formulas: Record<string, any> = {
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
  },
  LOG: {
    type: formulaTypes.NUMERIC,
    validation: {},
    description: 'Logarithm of input parameter to the base (default = e) specified',
    syntax: 'LOG([base], value)',
    examples: ['LOG(2, 1024) => 10', 'LOG(2, {column1})'],
  },
  EXP: {
    type: formulaTypes.NUMERIC,
    validation: {},
    description: 'Exponential value of input parameter (e ^ power)',
    syntax: 'EXP(power)',
    examples: ['EXP(1) => 2.718281828459045', 'EXP({column1})'],
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
  },
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
