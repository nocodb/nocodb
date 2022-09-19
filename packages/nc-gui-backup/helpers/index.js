import dayjs from 'dayjs'

const relativeTime = require('dayjs/plugin/relativeTime')
const utc = require('dayjs/plugin/utc')
dayjs.extend(utc)
dayjs.extend(relativeTime)

export function calculateDiff(date) {
  return dayjs.utc(date).fromNow()
}

export function formatDateToLocal(date) {
  return dayjs.utc(date).local().format()
}

export const isEmail = v => /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})$/i.test(v)

// ref : https://stackoverflow.com/a/5717133
export const isValidURL = (str) => {
  const pattern = /^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00A1-\uFFFF0-9]-*)*[a-z\u00A1-\uFFFF0-9]+)(?:\.(?:[a-z\u00A1-\uFFFF0-9]-*)*[a-z\u00A1-\uFFFF0-9]+)*(?:\.(?:[a-z\u00A1-\uFFFF]{2,}))\.?)(?::\d{2,5})?(?:[/?#]\S*)?$/i
  return !!pattern.test(str)
}

export const parseIfInteger = v => /^\d+$/.test(v) ? +v : v

// ref : https://stackoverflow.com/a/11077016
export function insertAtCursor(myField, myValue, len = 0, b = 0) {
  // IE support
  if (document.selection) {
    myField.focus()
    const sel = document.selection.createRange()
    sel.text = myValue
  } // MOZILLA and others
  else if (myField.selectionStart || myField.selectionStart == '0') {
    const startPos = myField.selectionStart
    const endPos = myField.selectionEnd
    myField.value = myField.value.substring(0, startPos - len) +
      myValue +
      myField.value.substring(endPos, myField.value.length)

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

function ReturnWord(text, caretPos) {
  const index = text.indexOf(caretPos)
  const preText = text.substring(0, caretPos)
  if (preText.indexOf(' ') > 0) {
    const words = preText.split(' ')
    return words[words.length - 1] // return last word
  } else {
    return preText
  }
}

export function getWordUntilCaret(ctrl) {
  const caretPos = GetCaretPosition(ctrl)
  const word = ReturnWord(ctrl.value, caretPos)
  return word || ''
}

function GetCaretPosition(ctrl) {
  let CaretPos = 0 // IE Support
  if (document.selection) {
    ctrl.focus()
    const Sel = document.selection.createRange()
    Sel.moveStart('character', -ctrl.value.length)
    CaretPos = Sel.text.length
  }
  // Firefox support
  else if (ctrl.selectionStart || ctrl.selectionStart == '0') {
    CaretPos = ctrl.selectionStart
  }
  return (CaretPos)
}

export function validateTableName(v, isGQL) {
  if (!v) {
    return 'Table name required'
  }

  // GraphQL naming convention
  // http://spec.graphql.org/June2018/#Name

  if (isGQL) {
    if (/^[_A-Za-z][_0-9A-Za-z]*$/.test(v)) {
      return true
    }

    if (/^[^_A-Za-z]/.test(v)) {
      return 'Name should start with an alphabet or _'
    }
    const m = v.match(/[^_A-Za-z\d]/g)
    if (m) {
      return `Following characters are not allowed ${m
        .map(c => JSON.stringify(c))
        .join(', ')}`
    }
  } else {
    // exclude . / \
    // rest all characters allowed
    // https://documentation.sas.com/doc/en/pgmsascdc/9.4_3.5/acreldb/n0rfg6x1shw0ppn1cwhco6yn09f7.htm#:~:text=By%20default%2C%20MySQL%20encloses%20column,not%20truncate%20a%20longer%20name.
    const m = v.match(/[./\\]/g)
    if (m) {
      return `Following characters are not allowed ${m
        .map(c => JSON.stringify(c))
        .join(', ')}`
    }

    return true
  }
}

export function validateColumnName(v, isGQL) {
  if (!v) {
    return 'Column name required'
  }

  // GraphQL naming convention
  // http://spec.graphql.org/June2018/#Name
  if (isGQL) {
    if (/^[_A-Za-z][_0-9A-Za-z]*$/.test(v)) {
      return true
    }

    if (/^[^_A-Za-z]/.test(v)) {
      return 'Name should start with an alphabet or _'
    }
    const m = v.match(/[^_A-Za-z\d]/g)
    if (m) {
      return `Following characters are not allowed ${m
        .map(c => JSON.stringify(c))
        .join(', ')}`
    }
  } else {
    // exclude . / \
    // rest all characters allowed
    // https://documentation.sas.com/doc/en/pgmsascdc/9.4_3.5/acreldb/n0rfg6x1shw0ppn1cwhco6yn09f7.htm#:~:text=By%20default%2C%20MySQL%20encloses%20column,not%20truncate%20a%20longer%20name.
    const m = v.match(/[./\\]/g)
    if (m) {
      return `Following characters are not allowed ${m
        .map(c => JSON.stringify(c))
        .join(', ')}`
    }

    return true
  }
}

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
