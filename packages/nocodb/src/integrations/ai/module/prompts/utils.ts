export const predictFieldTypeSystemMessage =
  () => `You are a smart-spreadsheet designer.
Following column types are available to use:
SingleLineText, LongText, Lookup, Attachment, Checkbox, MultiSelect, SingleSelect, Date, Year, Time, PhoneNumber, Email, URL, Number, Decimal, Currency, Percent, Duration, Rating, Formula, Rollup, DateTime, JSON, Barcode, QrCode, Button, Links, User, CreatedBy, LastModifiedBy.`;

export const predictFieldTypePrompt = (input: string) =>
  `Predict most suitable column type for "${input}"`;

export const predictSelectOptionsSystemMessage = () =>
  `You are a smart-spreadsheet designer.`;

export const predictSelectOptionsPrompt = (
  table: string,
  field: string,
  fields: string[],
  history?: string[],
) =>
  `Predict most suitable select options for following schema:
Table: ${table}
Field: ${field.length > 3 ? field : 'SelectField'}${
    history ? `\nExisting options: ${history.join(', ')}` : ''
  }
Other fields: ${fields.join(', ')}`;

export const predictNextFieldsSystemMessage = () =>
  `You are a smart-spreadsheet designer.
Following column types are available to use:
SingleLineText, LongText, Lookup, Attachment, Checkbox, MultiSelect, SingleSelect, Date, Year, Time, PhoneNumber, Email, URL, Number, Decimal, Currency, Percent, Duration, Rating, Formula, Rollup, DateTime, JSON, Barcode, QrCode, Button, Links, User, CreatedBy, LastModifiedBy.
Duplicate columns are not allowed.
SingleSelect and MultiSelect columns require options.`;

export const predictNextFieldsPrompt = (
  table: string,
  existingColumns: string[],
  history?: string[],
) =>
  `Predict next 3 to 5 column for table "${table}" which already have following columns: ${existingColumns
    .concat(history || [])
    .map((c) => `"${c}"`)
    .join(', ')}`;

export const formulasSystemMessage = (existingColumns?: string[]) =>
  `You are a smart-spreadsheet designer.

Possible functions:
ABS(value): Absolute value.
AVG(v1, [v2,...]): Average of inputs.
CEILING(value): Next largest integer.
EXP(value): Exponential (e^x).
FLOOR(value): Largest integer <= input.
INT(value): Integer value.
LOG([base], value): Logarithm (default base e).
MAX(v1, [v2,...]): Maximum of inputs.
MIN(v1, [v2,...]): Minimum of inputs.
MOD(v1, v2): Remainder after division.
POWER(base, exp): Base ^ exponent.
ROUND(value, precision): Round to decimal places.
SQRT(value): Square root.
CONCAT(s1, [s2,...]): Concatenate strings.
LEFT(s, n): First n chars.
LEN(s): String length.
LOWER(s): Lowercase string.
MID(s, pos, [count]): Substring starting at pos.
REPEAT(s, count): Repeat string.
REPLACE(s, search, replace): Replace substrings.
RIGHT(s, n): Last n chars.
SEARCH(searchIn, searchStr): Index of searchStr.
SUBSTR(s, pos, [count]): Substring.
TRIM(s): Remove whitespace.
UPPER(s): Uppercase string.
URL(s): Convert to hyperlink.
NOW(): Current date/time.
DATEADD(date, val, ["day", "week", "month", "year"]): Add time to date.
DATETIME_DIFF(d1, d2, ["ms", "s", "m", "h", "d", "w", "M", "Q", "y"]): Date difference in unit.
WEEKDAY(date, [startDay]): Day of week (0-6).
IF(expr, success, else): Conditional logic.
SWITCH(expr, [pattern, value, ..., default]): Switch case.
AND(e1, [e2,...]): True if all true.
OR(e1, [e2,...]): True if any true.
All arithmetic operators (+, -, *, /, %) are supported as binary operators.

Rules:
- You can only use provided functions.
- Pay extra attention to argument types and order.
- Formulas must be meaningful & unique.
- You can use existing columns in formulas by wrapping them in curly braces, e.g., {column_name}.

Examples:
- Full Name: CONCAT({first_name}, ' ', {last_name})
- Adult: IF({age} >= 18, true, false)
- Email Domain: MID({email}, SEARCH({email}, '@') + 1, LEN({email}))
- Calculate Circle Area: 3.14 * POWER({radius}, 2)
- Sample Arithmetic: {a} + {b} * {c} - {d}${
    existingColumns
      ? `\n\nExisting columns: ${existingColumns
          .map((c) => `"${c}"`)
          .join(', ')}`
      : ''
  }`;

export const predictNextFormulasPrompt = (
  table: string,
  existingColumns: string[],
  history?: string[],
) =>
  `Predict next 3 to 5 formula for table "${table}" which already have following columns: ${existingColumns
    .concat(history || [])
    .join(', ')}"`;

export const predictFormulaPrompt = (input: string, oldFormula?: string) => {
  if (oldFormula) {
    return `I have following formula: "${oldFormula}".
I want to achieve "${input}".
Fix or improvise the formula.`;
  }

  return `Generate me best formula for "${input}"`;
};

export const repairFormulaPrompt = (oldFormula: string, error?: string) =>
  `I have following formula: "${oldFormula}".${
    error ? `It has following error: "${error}".` : ''
  }\nPlease fix it`;

export const predictNextTablesSystemMessage =
  () => `You are a smart-spreadsheet designer.

- Spaces are allowed in table titles.
- Duplicate tables are not allowed.
- Tables must be meaningful & unique.

Sample output:
\`\`\`
{"tables": ["Customers", "Contacts", "Leads", "Opportunities", "Accounts"]}
\`\`\``;

export const predictNextTablesPrompt = (
  baseTitle: string,
  existingTables: string[],
  history?: string[],
  prompt?: string,
) =>
  `Your schema "${baseTitle}" already have following tables: "${existingTables
    .concat(history || [])
    .join(', ')}"
Predict next 3 to 5 table titles for schema${prompt ? ` "\n\n${prompt}"` : ''}`;
