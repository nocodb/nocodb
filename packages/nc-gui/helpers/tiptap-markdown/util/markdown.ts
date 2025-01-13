import markdownit from 'markdown-it'

const md = markdownit()

function scanDelims(text, pos) {
  md.inline.State.prototype.scanDelims.call({ src: text, posMax: text.length })
  const state = new md.inline.State(text, null, null, [])
  return state.scanDelims(pos, true)
}

export function shiftDelim(text, delim, start, offset) {
  let res = text.substring(0, start) + text.substring(start + delim.length)
  res = res.substring(0, start + offset) + delim + res.substring(start + offset)
  return res
}

function trimStart(text, delim, from, to) {
  let pos = from
  let res = text
  while (pos < to) {
    if (scanDelims(res, pos).can_open) {
      break
    }
    res = shiftDelim(res, delim, pos, 1)
    pos++
  }
  return { text: res, from: pos, to }
}

function trimEnd(text, delim, from, to) {
  let pos = to
  let res = text
  while (pos > from) {
    if (scanDelims(res, pos).can_close) {
      break
    }
    res = shiftDelim(res, delim, pos, -1)
    pos--
  }
  return { text: res, from, to: pos }
}

export function trimInline(text, delim, from, to) {
  let state = {
    text,
    from,
    to,
  }

  state = trimStart(state.text, delim, state.from, state.to)
  state = trimEnd(state.text, delim, state.from, state.to)

  if (state.to - state.from < delim.length + 1) {
    state.text = state.text.substring(0, state.from) + state.text.substring(state.to + delim.length)
  }

  return state.text
}
