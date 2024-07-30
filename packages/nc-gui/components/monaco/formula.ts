import type { Thenable, editor, languages } from 'monaco-editor'

import { formulas } from 'nocodb-sdk'

const formulaKeyWords = Object.keys(formulas)

const theme: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: '#00921d' },
    { token: 'number', foreground: '#9c6200' },
    { token: 'operator', foreground: '#000000' },
    { token: 'identifier', foreground: '#8541f9' },
    { token: 'string', foreground: '#007b77' },
    { token: 'delimiter.bracket', foreground: '#333333' },
    { token: 'delimiter.parenthesis', foreground: '#8541f9' },
  ],

  colors: {
    'editor.foreground': '#000000',
    'editor.background': '#FFFFFF',
    'editorCursor.foreground': '#3366FF',
    'editor.selectionBackground': '#3366FF50',
  },
}

const languageDefinition: languages.IMonarchLanguage | Thenable<languages.IMonarchLanguage> = {
  defaultToken: 'invalid',
  keywords: formulaKeyWords,
  brackets: [
    { open: '(', close: ')', token: 'delimiter.parenthesis' },
    { open: '{', close: '}', token: 'delimiter.brace' },
  ],
  tokenizer: {
    root: [
      [
        /[a-zA-Z_]\w*/,
        {
          cases: {
            '@keywords': 'keyword',
            '@default': 'identifier',
          },
        },
      ],

      [/\d+/, 'number'],

      [/[-+/*=<>!]+/, 'operator'],

      [/[{}()\[\]]/, '@brackets'],
      [/[ \t\r\n]+/, 'white'],

      [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
    ],

    string: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
    ],
  },
}
