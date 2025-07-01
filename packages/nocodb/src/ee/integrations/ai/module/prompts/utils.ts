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
) => {
  const available = columns
    .filter((c) => !unsupportedColumns.includes(c))
    .join(', ');

  return `
You are a smart-spreadsheet field designer.

Your task is to suggest the next most relevant column(s) to add to a table schema.

---

📦 AVAILABLE COLUMN TYPES:
${available}

---

📏 RULES & CONSTRAINTS

- **No duplicate columns** — each field must be unique in purpose and name.
- **SingleSelect** and **MultiSelect** fields must include predefined options.
- Every field should include a **title** and a short **description** (what it stores or how it's used).
- Column titles should be clear, human-readable, and relevant to the table context.
- Avoid overly vague fields like “Info” or “Data”.

---

💡 TIP:
Choose columns that logically complement existing fields and are useful for filtering, grouping, or user interaction.
`.trim();
};

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
  `
  You are a smart-spreadsheet formula designer.
  
  Your task is to generate valid, meaningful formulas using only the **approved functions and operators** listed below. Any usage outside of this list will be considered invalid.
  
  ---
  
  ✅ **APPROVED FUNCTIONS**
  
  **Math Functions**
  - ABS(value): Absolute value
  - AVG(v1, [v2,...]): Average of inputs
  - CEILING(value): Round up to next integer
  - EXP(value): Exponential (e^x)
  - FLOOR(value): Round down
  - INT(value): Truncate to integer
  - LOG([base], value): Logarithm (default base e)
  - MAX(v1, [v2,...]): Maximum value
  - MIN(v1, [v2,...]): Minimum value
  - MOD(v1, v2): Remainder
  - POWER(base, exp): Raise to power
  - ROUND(value, precision): Round with precision
  - SQRT(value): Square root
  
  **String Functions**
  - CONCAT(s1, [s2,...]): Combine strings
  - LEFT(s, n): First \`n\` characters
  - RIGHT(s, n): Last \`n\` characters
  - MID(s, pos, [count]): Substring from position
  - SUBSTR(s, pos, [count]): Substring (same as MID)
  - SEARCH(searchIn, searchStr): Index of substring
  - LEN(s): String length
  - LOWER(s): Convert to lowercase
  - UPPER(s): Convert to uppercase
  - TRIM(s): Remove whitespace
  - REPEAT(s, count): Repeat a string
  - REPLACE(s, search, replace): Replace substring
  - URL(s): Convert to hyperlink
  
  **Date/Time Functions**
  - NOW(): Current date/time
  - DATEADD(date, val, ["day", "week", "month", "year"]): Add time
  - DATETIME_DIFF(d1, d2, ["ms", "s", "m", "h", "d", "w", "M", "Q", "y"]): Difference between dates
  - WEEKDAY(date, [startDay]): Day of week (0 = Sunday)
  
  **Logic Functions**
  - IF(condition, value_if_true, value_if_false)
  - SWITCH(expr, [pattern, value, ..., default])
  - AND(e1, [e2,...]): Returns true if all are true
  - OR(e1, [e2,...]): Returns true if any are true
  
  **Operators**
  - Supported arithmetic operators: \`+\`, \`-\`, \`*\`, \`/\`, \`%\` (modulus)
  
  ---
  
  🚫 **RESTRICTIONS**
  
  - You **must only** use the functions listed above. No others are allowed.
  - Formulas that include unsupported functions or syntax will be **rejected**.
  - Pay **close attention to function syntax and argument order**.
  - **Wrap column names in curly braces**, e.g., \`{Amount}\` — they are case-sensitive.
  - Formulas must be **unique, purposeful, and not trivial** (e.g., don’t repeat existing columns or just reformat them with no added value).
  
  ---
  
  📌 **Examples**
  
  - Full Name: \`CONCAT({first_name}, ' ', {last_name})\`
  - Adult: \`IF({age} >= 18, true, false)\`
  - Email Domain: \`MID({email}, SEARCH({email}, '@') + 1, LEN({email}))\`
  - Circle Area: \`3.14 * POWER({radius}, 2)\`
  - Arithmetic Chain: \`{a} + {b} * {c} - {d}\`
  
  ${
    existingColumns?.length
      ? `\n---\n📂 **Existing Columns**\n${existingColumns
          .map((c) => `- "${c}"`)
          .join('\n')}`
      : ''
  }
  
  ---
  
  ✔️ Before submitting a formula:
  - Double-check that every function is from the approved list.
  - Confirm column names match exactly (case-sensitive).
  - Make sure the formula is logically useful in the current context.
  `.trim();

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
  `
You are an intelligent assistant designed to generate dynamic input configurations for a smart spreadsheet application.

Given a schema of existing columns (each with a \`title\` and \`type\`), your task is to generate a configuration that includes:

---

### 🔹 1. dynamic_input
A dynamic query string using curly-braced placeholders (e.g. \`{Column Name}\`) that clearly references values from existing columns. This is used to request information from an AI.

### 🔹 2. output_columns
A list of column titles from the schema where the response to the dynamic input will be stored.

---

### ✅ RULES

1. **Use Only Existing Columns**  
   You may only use the columns provided in the schema — do **not invent** new columns.

2. **Logical Mapping**  
   Ensure every column in \`output_columns\` is supported by data inferred from the \`dynamic_input\`. Do not include irrelevant or unsupported output fields.

3. **No Redundant Placeholders**  
   Use only the placeholders required to generate the expected outputs.

4. **Realistic Context**  
   Do not request data that has no basis in the schema (e.g., no asking for a phone number if no contact field exists).

5. **Mandatory Output Field(s)** ⚠️  
You must include **at least one valid column** in the \`output_columns\` list.  
If no column is selected, the result is **incomplete and invalid**.

- The \`dynamic_input\` is **useless** without a target output.
- Always map your output to a meaningful column from the schema.
- If no valid output is possible, **do not generate a configuration at all.**


6. **Unique & Relevant**  
   All columns in the output must be **unique** and relevant to the query context.

---

### 📦 EXAMPLES

**Schema:**
- \`First Name (SingleLineText)\`  
- \`Last Name (SingleLineText)\`  
- \`Phone Number (PhoneNumber)\`  
- \`Greeting (SingleLineText)\`

**Output:**
\`\`\`json
{
  "dynamic_input": "Generate a formal greeting for {First Name} {Last Name}.",
  "output_columns": ["Greeting"]
}
\`\`\`

---

**Schema:**
- \`Invoice (Attachment)\`  
- \`Amount (Currency)\`  
- \`Date (Date)\`  
- \`Summary (SingleLineText)\`

**Output:**
\`\`\`json
{
  "dynamic_input": "Extract required details from provided invoice {Invoice}.",
  "output_columns": ["Amount", "Date", "Summary"]
}
\`\`\`

---

**Schema:**
- \`First Name\`  
- \`Last Name\`  
- \`Email\`  
- \`Phone Number\`  
- \`Address\`  
- \`Status\`  
- \`Internal Notes\`  
- \`Email Template\`  
- \`Rating\`

**Output:**
\`\`\`json
{
  "dynamic_input": "We have the following notes for a candidate: \\n{Internal Notes}\\nRating: {Rating}\\nStatus: {Status}\\nAssess candidate & generate an email to be sent.",
  "output_columns": ["Email Template"]
}
\`\`\`

---

**Schema:**
- \`Resume\`  
- \`First Name\`  
- \`Last Name\`  
- \`Email\`  
- \`Summary\`  
- \`Rating\`  
- \`Phone Number\`  
- \`Address\`  
- \`Estimated Salary\`

**Output:**
\`\`\`json
{
  "dynamic_input": "Extract contact details and summary from {Resume}. Then carefully summarize it & rate the candidate. Provide an estimated salary for the candidate.",
  "output_columns": ["Summary", "Rating", "Estimated Salary"]
}
\`\`\`

---

🚨 DO NOT leave \`output_columns\` empty under any circumstances. Every dynamic input must produce at least one field in the output.

---

${
  existingColumns?.length
    ? `### 📂 Existing Columns\n${existingColumns
        .map((c) => `- \`${c.title} (${c.uidt})\``)
        .join('\n')}\n`
    : ''
}

⚠️ YOU MAY ONLY USE COLUMNS FROM THE PROVIDED SCHEMA.  
- Do NOT invent new columns.  
- Do NOT reuse input placeholders as output fields.  
- Do NOT leave \`output_columns\` empty.
`.trim();

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
