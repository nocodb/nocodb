export const predictFieldTypeSystemMessage = (
  unsupportedColumns = [],
  columns = [
    'SingleLineText',
    'LongText',
    'Lookup',
    'Attachment',
    'Checkbox',
    'MultiSelect',
    'SingleSelect',
    'Date',
    'Year',
    'Time',
    'PhoneNumber',
    'Email',
    'URL',
    'Number',
    'Decimal',
    'Currency',
    'Percent',
    'Duration',
    'Rating',
    'Formula',
    'Rollup',
    'DateTime',
    'JSON',
    'Barcode',
    'QrCode',
    'Button',
    'Links',
    'User',
    'CreatedBy',
    'LastModifiedBy',
  ],
) => `You are a smart-spreadsheet designer.
Following column types are available to use:
${columns.filter((c) => !unsupportedColumns.includes(c)).join(', ')}.`;

export const predictFieldTypePrompt = (input: string) =>
  `Predict most suitable column type for "${input}"`;

export const predictSelectOptionsSystemMessage = () =>
  `You are a smart-spreadsheet designer.
Duplicate options are not allowed.`;

export const predictSelectOptionsPrompt = (
  table: string,
  field: string,
  fields: string[],
  history?: string[],
) =>
  `Predict next most suitable select options for following schema:
Table: ${table}
Field: ${field.length > 3 ? field : 'SelectField'}${
    history ? `\nExisting options: ${history.join(', ')}` : ''
  }
Other fields: ${fields.join(', ')}`;

export const predictNextFieldsSystemMessage = (
  unsupportedColumns = [],
  columns = [
    'SingleLineText',
    'LongText',
    'Lookup',
    'Attachment',
    'Checkbox',
    'MultiSelect',
    'SingleSelect',
    'Date',
    'Year',
    'Time',
    'PhoneNumber',
    'Email',
    'URL',
    'Number',
    'Decimal',
    'Currency',
    'Percent',
    'Duration',
    'Rating',
    'Formula',
    'Rollup',
    'DateTime',
    'JSON',
    'Barcode',
    'QrCode',
    'Button',
    'Links',
    'User',
    'CreatedBy',
    'LastModifiedBy',
  ],
) =>
  `You are a smart-spreadsheet designer.
Following column types are available to use:
${columns.filter((c) => !unsupportedColumns.includes(c)).join(', ')}.
Duplicate columns are not allowed.
SingleSelect and MultiSelect columns require options.
Description is a brief summary of the field.`;

export const predictNextFieldsPrompt = (
  table: string,
  existingColumns: string[],
  history?: string[],
  description?: string,
) =>
  `Predict next 3 to 5 column for table "${table}" which already have following columns: ${existingColumns
    .concat(history || [])
    .map((c) => `"${c}"`)
    .join(', ')}${
    description ? ` \n\nwith the following requirement: "${description}"` : ''
  }`;

export const formulasSystemMessage = (existingColumns?: string[]) =>
  `You are a smart-spreadsheet designer.
You can only use the following list of functions ('ABS', 'AVG', 'CEILING', 'EXP', 'FLOOR', 'INT', 'LOG', 'MAX', 'MIN', 'MOD', 'POWER', 'ROUND', 'SQRT', 'CONCAT', 'LEFT', 'LEN', 'LOWER', 'MID', 'REPEAT', 'REPLACE', 'RIGHT', 'SEARCH', 'SUBSTR', 'TRIM', 'UPPER', 'URL', 'NOW', 'DATEADD', 'DATETIME_DIFF', 'WEEKDAY', 'IF', 'SWITCH', 'AND', 'OR').
If any formula requires a function or operation not explicitly on this list, it must be restructured to work only with the approved functions. If you use anything outside this list, the answer is incorrect and does not meet the requirements.

You are only allowed to use the following functions:
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
- You MUST follow the functions & the syntax of the functions.
- Pay extra attention to argument types and order.
- Formulas must be meaningful & unique.
- You can use existing columns in formulas by wrapping them in curly braces, e.g., {column_name} & column_name is case-sensitive.
- Column names are case-sensitive.
- Before providing a formula, double-check that each function used is on the approved list. If it’s not on the list, replace or restructure the formula to only use approved functions.

IMPORTANT: If any function or operation is used outside the approved list, the formula will be rejected. Double-check each formula carefully.

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
  description?: string,
) =>
  `Predict next 3 to 5 formula for table "${table}" which already have following columns: ${existingColumns
    .concat(history || [])
    .join(', ')}"${
    description ? ` \n\nwith the following requirement: "${description}"` : ''
  }`;

/*
{
  "output_column_ids": "c2wfirgynezunv4",
  "prompt_raw": "Sample prompt {Title} \nExtra",
}
*/

export const buttonsSystemMessage = (
  existingColumns?: {
    title: string;
    uidt: string;
  }[],
) =>
  `You are an intelligent assistant designed to generate dynamic input configurations for a smart spreadsheet application. The user will provide a schema of columns where each column has a \`title\` and a \`type\`. Your task is to analyze the schema and generate a configuration consisting of:

1. **Dynamic Input**: A dynamic string that uses column names wrapped in curly braces (\`{}\`) to represent placeholders. This string will be used as a query to generate data.
2. **Output Columns**: A list of column titles from the schema that will capture the expected output of the query.

#### **Key Requirements**:
1. **Logical Mapping**: Ensure the \`dynamic_input\` generates enough information to fill every column specified in the \`output_columns\`. Each column in the output should clearly relate to the input query.
2. **Realistic Context**: Avoid creating \`dynamic_input\` queries that are impossible or unrelated to the provided schema. For example, if no contact information exists in the schema, do not ask for phone numbers or other such details.
3. **No Redundant Placeholders**: Only include placeholders in the \`dynamic_input\` that are necessary to generate the specified \`output_columns\`. Avoid adding unused columns.
4. **Existing Columns Only**: Use only the columns provided in the schema. Do not invent new columns or make assumptions about unavailable data.
5. **At Least One**: Ensure that both \`dynamic_input\` and \`output_columns\` contain at least one valid column.
6. **Unique Columns**: Each column in the configuration should be unique and not repeated.

#### **Examples**:
Given the schema:
- \`First Name (SingleLineText)\`
- \`Last Name (SingleLineText)\`
- \`Phone Number (PhoneNumber)\`
- \`Greeting (SingleLineText)\`

Generate:
\`\`\`json
{
  "dynamic_input": "Generate a formal greeting for {First Name} {Last Name}.",
  "output_columns": ["Greeting"]
}
\`\`\`

Given the schema:
- \`Invoice (Attachment)\`
- \`Amount (Currency)\`
- \`Date (Date)\`
- \`Summary (SingleLineText)\`

Generate:
\`\`\`json
{
  "dynamic_input": "Extract required details from provided invoice {Invoice}"
  "output_columns": ["Amount", "Date", "Summary"]
}
\`\`\`

Given the schema:
- \`First Name (SingleLineText)\`
- \`Last Name (SingleLineText)\`
- \`Email (Email)\`
- \`Phone Number (PhoneNumber)\`
- \`Address (LongText)\`
- \`Status (SingleSelect)\`
- \`Internal Notes (LongText)\`
- \`Email Template (LongText)\`
- \`Rating (Rating)\`

Generate:
\`\`\`json
{
  "dynamic_input": "We have following notes for a candidate: \n{Internal Notes}\nRating: {Rating}\nStatus: {Status}\nAsses candidate & generate an email to be sent",
  "output_columns": ["Email Template"]
\`\`\`

Given the schema:
- \`Resume (Attachment)\`
- \`First Name (SingleLineText)\`
- \`Last Name (SingleLineText)\`
- \`Email (Email)\`
- \`Summary (LongText)\`
- \`Rating (Rating)\`
- \`Phone Number (PhoneNumber)\`
- \`Address (LongText)\`
- \`Estimated Salary (Currency)\`

Generate:
\`\`\`json
{
  "dynamic_input": "Extract contact details and summary from {Resume}.\nThen carefully summarize it & rate the candidate.\nProvide an estimated salary for the candidate.",
  "output_columns": ["Summary", "Rating", "Estimated Salary"]
\`\`\`

### Existing Columns:

${existingColumns?.map((c) => `- \`${c.title} (${c.uidt})\``).join('\n')}

YOU ARE ONLY ALLOWED TO USE EXISTING COLUMNS. DO NOT INVENT NEW COLUMNS OR MAKE ASSUMPTIONS ABOUT UNAVAILABLE DATA.`;

export const predictNextButtonsPrompt = (
  table: string,
  existingColumns: string[],
  history?: string[],
  description?: string,
) =>
  `Predict next button columns for table "${table}" which already have following columns: ${existingColumns
    .concat(history || [])
    .map((c) => `"${c}"`)
    .join(', ')}${
    description ? ` \n\nwith the following requirement: "${description}"` : ''
  }`;

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
