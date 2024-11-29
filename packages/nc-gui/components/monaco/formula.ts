import type { Thenable, editor, languages } from 'monaco-editor'

import { formulas } from 'nocodb-sdk'

const formulaKeyWords = Object.keys(formulas)

const theme: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'string', foreground: '#007b77', fontStyle: 'bold' },
    { token: 'keyword', foreground: '#00921d', fontStyle: 'bold' },
    { token: 'number', foreground: '#9c6200', fontStyle: 'bold' },
    { token: 'operator', foreground: '#000000' },
    { token: 'identifier', foreground: '#8541f9', fontStyle: 'bold' },
    { token: 'delimiter.parenthesis', foreground: '#333333', fontStyle: 'bold' },
    { token: 'delimiter.brace', foreground: '#8541f9', fontStyle: 'bold' },
    { token: 'invalid', foreground: '#000000' },
  ],

  colors: {
    'editor.foreground': '#000000',
    'editor.background': '#FFFFFF',
    'editorCursor.foreground': '#3366FF',
    'editor.selectionBackground': '#3366FF50',
    'focusBorder': '#ffffff',
  },
}

const generateLanguageDefinition = (identifiers: string[]) => {
  identifiers = identifiers.map((identifier) => `{${identifier}}`)

  const languageDefinition: languages.IMonarchLanguage | Thenable<languages.IMonarchLanguage> = {
    defaultToken: 'invalid',
    keywords: formulaKeyWords,
    identifiers,
    brackets: [
      { open: '(', close: ')', token: 'delimiter.parenthesis' },
      { open: '{', close: '}', token: 'delimiter.brace' },
    ],
    tokenizer: {
      root: [
        [/"/, { token: 'string.quote', bracket: '@open', next: '@dblString' }],
        [/'/, { token: 'string.quote', bracket: '@open', next: '@sglString' }],
        [
          new RegExp(
            `\\{(${identifiers
              .map((identifier) =>
                identifier
                  // remove curly braces wrapping the identifier
                  .replace(/^\{([\s\S]+)\}$/, '$1')
                  // escape special characters
                  .replace(/[.*+?^${}()|[\]\\-]/g, '\\$&'),
              )
              .join('|')})\\}`,
          ),
          {
            cases: {
              '@identifiers': 'identifier',
              '@default': 'invalid',
            },
          },
        ],
        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              '@keywords': 'keyword',
              '@default': 'invalid',
            },
          },
        ],
        [/\d+/, 'number'],
        [/[-+/*=<>!]+/, 'operator'],
        [/[{}()]/, '@brackets'],
        [/[ \t\r\n]+/, 'white'],
      ],

      dblString: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
      ],

      sglString: [
        [/[^\\']+/, 'string'],
        [/\\./, 'string.escape'],
        [/'/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
      ],
    },
  }

  return languageDefinition
}

const languageConfiguration: languages.LanguageConfiguration = {
  brackets: [
    ['{', '}'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
}

export default {
  name: 'formula',
  theme,
  generateLanguageDefinition,
  languageConfiguration,
}
