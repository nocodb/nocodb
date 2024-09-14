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

export const predictNextFormulasSystemMessage = () =>
  `You are a smart-spreadsheet designer.
NocoDB supports following formula functions:
Numeric Functions
ABS(x): Absolute value.
ADD(x, [y, ...]): Sum.
AVG(x, [y, ...]): Average.
CEILING(x): Round up.
COUNT(x, [y, ...]): Count numbers.
COUNTA(x, [y, ...]): Count non-empty.
COUNTALL(x, [y, ...]): Count all.
EVEN(x): Nearest even number.
EXP(x): e^x.
FLOOR(x): Round down.
INT(x): Integer part.
LOG(base, x): Logarithm.
MAX(x, [y, ...]): Maximum.
MIN(x, [y, ...]): Minimum.
MOD(x, y): Remainder.
ODD(x): Nearest odd number.
POWER(x, y): x^y.
ROUND(x, [precision]): Round.
ROUNDDOWN(x, [precision]): Round down.
ROUNDUP(x, [precision]): Round up.
SQRT(x): Square root.
VALUE(str): Convert to number.
String Functions
CONCAT(x, [y, ...]): Concatenate.
LEFT(str, n): Leftmost n chars.
LEN(str): String length.
LOWER(str): Lowercase.
MID(str, pos, [count]): Substring.
REPEAT(str, n): Repeat n times.
REPLACE(str, old, new): Replace text.
RIGHT(str, n): Rightmost n chars.
SEARCH(str, target): Find position.
SUBSTR(str, pos, [count]): Substring.
TRIM(str): Remove spaces.
UPPER(str): Uppercase.
URL(str): Convert to URL.
Date Functions
NOW(): Current date/time.
DATEADD(date, n, unit): Add time.
DATETIME_DIFF(date1, date2, unit): Date difference.
WEEKDAY(date, [start]): Day of the week.
Conditional Expressions
IF(cond, trueVal, falseVal): Conditional logic.
AND(x, [y, ...]): Logical AND.
OR(x, [y, ...]): Logical OR.

Each column can be used by wrapping it by curly braces. For example, {column_name}.
Example: CONCAT({first_name}, ' ', {last_name})`;

export const predictNextFormulasPrompt = (
  table: string,
  existingColumns: string[],
  history?: string[],
) =>
  `Predict next 3 to 5 formula for table "${table}" which already have following columns: ${existingColumns
    .concat(history || [])
    .join(', ')}"`;

export const predictNextTablesSystemMessage =
  () => `You are a smart-spreadsheet designer.
Duplicate tables are not allowed.`;

export const predictNextTablesPrompt = (
  baseTitle: string,
  existingTables: string[],
  history?: string[],
  prompt?: string,
) =>
  `Your schema "${baseTitle}" already have following tables: "${existingTables
    .concat(history || [])
    .join(', ')}"
Predict next 3 to 5 ${prompt ? 'most suitable tables for' + prompt : 'tables'}`;
