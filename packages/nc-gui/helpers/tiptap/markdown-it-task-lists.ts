// Markdown-it plugin to render GitHub-style task lists; see
//
// https://github.com/blog/1375-task-lists-in-gfm-issues-pulls-comments
// https://github.com/blog/1825-task-lists-in-all-markdown-documents

var disableCheckboxes = true
var useLabelWrapper = false
var useLabelAfter = false

export default function (md, options) {
  if (options) {
    disableCheckboxes = !options.enabled
    useLabelWrapper = !!options.label
    useLabelAfter = !!options.labelAfter
  }

  md.core.ruler.after('inline', 'github-task-lists', function (state) {
    var tokens = state.tokens
    for (var i = 2; i < tokens.length; i++) {
      if (isTodoItem(tokens, i)) {
        todoify(tokens[i], state.Token)
        attrSet(tokens[i - 2], 'class', 'task-list-item' + (!disableCheckboxes ? ' enabled' : ''))
        attrSet(tokens[parentToken(tokens, i - 2)], 'class', 'contains-task-list')
      }
    }
  })
}

function attrSet(token, name, value) {
  var index = token.attrIndex(name)
  var attr = [name, value]

  if (index < 0) {
    token.attrPush(attr)
  } else {
    token.attrs[index] = attr
  }
}

function parentToken(tokens, index) {
  var targetLevel = tokens[index].level - 1
  for (var i = index - 1; i >= 0; i--) {
    if (tokens[i].level === targetLevel) {
      return i
    }
  }
  return -1
}

function isTodoItem(tokens, index) {
  return (
    isInline(tokens[index]) &&
    isParagraph(tokens[index - 1]) &&
    isListItem(tokens[index - 2]) &&
    startsWithTodoMarkdown(tokens[index])
  )
}

function todoify(token, TokenConstructor) {
  token.children.unshift(makeCheckbox(token, TokenConstructor))
  token.children[1].content = token.children[1].content.slice(3)
  token.content = token.content.slice(3)

  if (useLabelWrapper) {
    if (useLabelAfter) {
      token.children.pop()

      // Use large random number as id property of the checkbox.
      var id = 'task-item-' + Math.ceil(Math.random() * (10000 * 1000) - 1000)
      token.children[0].content = token.children[0].content.slice(0, -1) + ' id="' + id + '">'
      token.children.push(afterLabel(token.content, id, TokenConstructor))
    } else {
      token.children.unshift(beginLabel(TokenConstructor))
      token.children.push(endLabel(TokenConstructor))
    }
  }
}

function makeCheckbox(token, TokenConstructor) {
  var checkbox = new TokenConstructor('html_inline', '', 0)
  var disabledAttr = disableCheckboxes ? ' disabled="" ' : ''
  if (token.content.indexOf('[ ] ') === 0) {
    checkbox.content = '<input class="task-list-item-checkbox"' + disabledAttr + 'type="checkbox">'
  } else if (token.content.indexOf('[x] ') === 0 || token.content.indexOf('[X] ') === 0) {
    checkbox.content = '<input class="task-list-item-checkbox" checked=""' + disabledAttr + 'type="checkbox">'
  }
  return checkbox
}

// these next two functions are kind of hacky; probably should really be a
// true block-level token with .tag=='label'
function beginLabel(TokenConstructor) {
  var token = new TokenConstructor('html_inline', '', 0)
  token.content = '<label>'
  return token
}

function endLabel(TokenConstructor) {
  var token = new TokenConstructor('html_inline', '', 0)
  token.content = '</label>'
  return token
}

function afterLabel(content, id, TokenConstructor) {
  var token = new TokenConstructor('html_inline', '', 0)
  token.content = '<label class="task-list-item-label" for="' + id + '">' + content + '</label>'
  token.attrs = [{ for: id }]
  return token
}

function isInline(token) {
  return token.type === 'inline'
}
function isParagraph(token) {
  return token.type === 'paragraph_open'
}
function isListItem(token) {
  return token.type === 'list_item_open'
}

function startsWithTodoMarkdown(token) {
  // leading whitespace in a list item is already trimmed off by markdown-it
  return token.content.indexOf('[ ] ') === 0 || token.content.indexOf('[x] ') === 0 || token.content.indexOf('[X] ') === 0
}
