import type { Input as AntInput } from 'ant-design-vue'
import { formulas } from 'nocodb-sdk'

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

// Function to check if cursor is inside Strings
function isCursorInsideString(text: string, offset: number) {
  let inSingleQuoteString = false
  let inDoubleQuoteString = false
  let escapeNextChar = false

  for (let i = 0; i < offset; i++) {
    const char = text[i]

    if (escapeNextChar) {
      escapeNextChar = false
      continue
    }

    if (char === '\\') {
      escapeNextChar = true
      continue
    }

    // `{...}` is a field reference: quotes in a title don't open a string
    if (char === '{' && !inSingleQuoteString && !inDoubleQuoteString) {
      const close = text.indexOf('}', i + 1)
      if (close === -1 || close >= offset) return false
      i = close
      continue
    }

    if (char === "'" && !inDoubleQuoteString) {
      inSingleQuoteString = !inSingleQuoteString
    } else if (char === '"' && !inSingleQuoteString) {
      inDoubleQuoteString = !inDoubleQuoteString
    }
  }

  return inDoubleQuoteString || inSingleQuoteString
}

// Rewrites Airtable-style `=` to `==` outside strings and `{field}` refs, so saved formula_raw stays parseable by older versions
function normalizeFormulaEquals(formula: string) {
  let result = ''
  let i = 0

  while (i < formula.length) {
    const char = formula[i]!

    if (char === '"' || char === "'") {
      let end = i + 1
      while (end < formula.length && formula[end] !== char) {
        end += formula[end] === '\\' ? 2 : 1
      }
      result += formula.slice(i, end + 1)
      i = end + 1
      continue
    }

    if (char === '{') {
      const close = formula.startsWith('{{', i) ? '}}' : '}'
      const end = formula.indexOf(close, i + 1)
      if (end === -1) return result + formula.slice(i)
      result += formula.slice(i, end + close.length)
      i = end + close.length
      continue
    }

    if (char === '=' && (i === 0 || !'=<>!'.includes(formula[i - 1]!)) && formula[i + 1] !== '=') {
      result += '=='
    } else {
      result += char
    }
    i++
  }

  return result
}

// Column reference being typed at the cursor, i.e. after an unclosed `{` on the current line.
// `end` also covers the rest of the reference up to its `}` (e.g. the auto-closed one) so it can be replaced.
function getColumnRefAtCursor(text: string, offset: number): { start: number; end: number; query: string } | null {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1
  const before = text.slice(lineStart, offset)
  const openIdx = before.lastIndexOf('{')

  if (openIdx === -1 || before.includes('}', openIdx)) return null

  const start = lineStart + openIdx
  if (isCursorInsideString(text, start)) return null

  let end = offset
  for (let i = offset; i < text.length; i++) {
    const char = text[i]
    if (char === '}') {
      end = i + 1
      break
    }
    // `'` is common in titles (Owner's Email), `"` isn't
    if (char === '{' || char === '\n' || char === '"') break
  }

  return { start, end, query: before.slice(openIdx + 1) }
}

const isWordStart = (title: string, index: number) => index === 0 || !/[\p{L}\p{N}]/u.test(title[index - 1]!)

// lowercase and drop accents, so `dias` matches `Días`
const foldTitle = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

// Case- and accent-insensitive substring match on titles: title prefix first, then word prefix, then anywhere
function filterColumnSuggestions<T extends { text: string }>(items: T[], query: string): T[] {
  const q = foldTitle(query.trim())
  if (!q) return [...items]

  const rank = (title: string) => {
    let index = title.indexOf(q)
    if (index === -1) return -1
    if (index === 0) return 0
    while (index !== -1) {
      if (isWordStart(title, index)) return 1
      index = title.indexOf(q, index + 1)
    }
    return 2
  }

  return items
    .map((item) => ({ item, rank: rank(foldTitle(item.text ?? '')) }))
    .filter(({ rank }) => rank !== -1)
    .sort((a, b) => a.rank - b.rank)
    .map(({ item }) => item)
}

export {
  filterColumnSuggestions,
  formulaList,
  formulas,
  getColumnRefAtCursor,
  getWordUntilCaret,
  insertAtCursor,
  isCursorInsideString,
  normalizeFormulaEquals,
}
