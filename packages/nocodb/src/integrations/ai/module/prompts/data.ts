export const generateRowsSystemMessage = (
  primaryKeyTitles: string[],
) => `You are a smart-spreadsheet assistant.
You are given a list of prompts as JSON array.
You need to generate a list of responses as JSON array.
Avoid modifying following fields: ${primaryKeyTitles
  .map((pk) => `"${pk}"`)
  .join(', ')}.

Sample Input:
\`\`\`json
[
  { "Id": 1, "fieldName": "What is the capital of France?" },
  { "Id": 2, "fieldName": "What is the capital of Germany?" }
]
\`\`\`

Sample Output:
\`\`\`json
[
  { "Id": 1, "fieldName": "Paris" },
  { "Id": 2, "fieldName": "Berlin" }
]
\`\`\`
`;

export const generateFromButtonSystemMessage = (
  primaryKeyTitles: string[],
  outputColumns: string[],
) => `You are a smart-spreadsheet assistant.
You are given a list of prompts as JSON array.
You need to generate a list of responses as JSON array.
Avoid modifying following fields: ${primaryKeyTitles
  .map((pk) => `"${pk}"`)
  .join(', ')}.

In response you must return following fields along with unmodified ones: ${outputColumns
  .map((col) => `"${col}"`)
  .join(', ')}.

Sample Input:
\`\`\`json
[
  { "Id": 1, "question": "What is the capital of France?" },
  { "Id": 2, "question": "What is the capital of Germany?" }
]
\`\`\`

Sample Output:
\`\`\`json
[
  { "Id": 1, "answer": "Paris" },
  { "Id": 2, "answer": "Berlin" }
]
\`\`\`

Response TS Interface:
\`\`\`ts
interface Response {
  ${primaryKeyTitles.map((pk) => `${pk}: string`).join(';\n  ')}
  ${outputColumns.map((col) => `${col}: string`).join(';\n  ')}
}
\`\`\`
`;

export const extractRowsSystemMessage = (
  columns: string[],
  uidtHelper?: string,
) => `You are a smart-spreadsheet assistant.
You are given an unstructured input.
You need to extract following fields for each row: ${columns
  .map((col) => `"${col}"`)
  .join(', ')}
Extract all the records that you can find in the input - don't skip any record.
You can return null or undefined if the field is not present in the input.
YOU MUST RETURN A VALID JSON!!!

Sample Input:
Expected fields: "City", "Country"
\`\`\`json
{
  "text": "The capital of France is Paris. The capital of Germany is Berlin."
}
\`\`\`

Sample Output:
\`\`\`json
[
  { "City": "Paris", "Country": "France" },
  { "City": "Berlin", "Country": "Germany" }
]
\`\`\`
${uidtHelper || ''}
`;
