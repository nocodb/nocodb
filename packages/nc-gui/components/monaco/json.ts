import type { editor } from 'monaco-editor'

export const jsonThemeLight: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'key', foreground: '#B33771', fontStyle: 'bold' },
    { token: 'string', foreground: '#2B99CC', fontStyle: 'semibold' },
    { token: 'number', foreground: '#1FAB51', fontStyle: 'semibold' },
    { token: 'boolean', foreground: '#1FAB51', fontStyle: 'semibold' },
    { token: 'delimiter', foreground: '#15171A', fontStyle: 'semibold' },
  ],
  colors: {
    'editor.background': '#FFFFFF',
    'editor.foreground': '#1A1A1A', // darker for contrast
    'editorCursor.foreground': '#2B99CC', // matches string accent
    'editor.selectionBackground': '#2B99CC33',
    'editor.lineHighlightBackground': '#00000008',
    'editorLineNumber.foreground': '#A0A0A0',
    'editorLineNumber.activeForeground': '#2B99CC',
    'editorIndentGuide.background': '#E0E0E0',
    'editorIndentGuide.activeBackground': '#C0C0C0',
    'focusBorder': '#00000010',
  },
}

export const jsonThemeDark: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'key', foreground: '#FF77AA', fontStyle: 'bold' }, // brightened for dark bg
    { token: 'string', foreground: '#66D1FF', fontStyle: 'semibold' },
    { token: 'number', foreground: '#4DE68A', fontStyle: 'semibold' },
    { token: 'boolean', foreground: '#4DE68A', fontStyle: 'semibold' },
    { token: 'delimiter', foreground: '#E6E6E6', fontStyle: 'semibold' },
  ],
  colors: {
    'editor.background': '#171717',
    'editor.foreground': '#ECECEC',
    'editorCursor.foreground': '#66D1FF',
    'editor.selectionBackground': '#66D1FF33',
    'editor.lineHighlightBackground': '#FFFFFF08',
    'editorLineNumber.foreground': '#5A5A5A',
    'editorLineNumber.activeForeground': '#66D1FF',
    'editorIndentGuide.background': '#2A2A2A',
    'editorIndentGuide.activeBackground': '#3A3A3A',
    'focusBorder': '#FFFFFF10',
  },
}
