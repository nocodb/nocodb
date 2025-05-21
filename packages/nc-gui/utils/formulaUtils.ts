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

    if (char === "'" && !inDoubleQuoteString) {
      inSingleQuoteString = !inSingleQuoteString
    } else if (char === '"' && !inSingleQuoteString) {
      inDoubleQuoteString = !inDoubleQuoteString
    }
  }

  return inDoubleQuoteString || inSingleQuoteString
}

export { formulaList, formulas, getWordUntilCaret, insertAtCursor, isCursorInsideString }
