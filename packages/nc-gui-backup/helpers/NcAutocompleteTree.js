// ref : https://medium.com/weekly-webtips/js-implementing-auto-complete-f4c5a5d5c009

class NcAutocompleteTree {
  constructor() {
    this.trie = null
    this.suggestions = []
  }

  newNode() {
    return {
      isLeaf: false,
      children: {}
    }
  }

  add(word) {
    if (!this.trie) {
      this.trie = this.newNode()
    }

    let root = this.trie
    for (const letter of word.text.toLowerCase()) {
      if (!(letter in root.children)) {
        root.children[letter] = this.newNode()
      }
      root = root.children[letter]
    }
    root.value = root.value || []
    root.value.push(word)
  }

  find(word) {
    let root = this.trie
    for (const letter of word) {
      if (letter in root.children) {
        root = root.children[letter]
      } else {
        return null // if not found return null
      }
    }

    return root // return the root where it ends search
  }

  traverse(root) {
    if (root.value && root.value.length) {
      this.suggestions.push(...root.value)
    }

    for (const letter in root.children) {
      this.traverse(root.children[letter])
    }
  }

  complete(word, CHILDREN = null) {
    this.suggestions = []
    const root = this.find(word.toLowerCase())

    if (!root) {
      return this.suggestions
    } // cannot suggest anything

    const children = root.children

    let spread = 0
    for (const letter in children) {
      this.traverse(children[letter], word + letter)
      spread++

      if (CHILDREN && spread === CHILDREN) {
        break
      }
    }

    return this.suggestions
  }
}

export default NcAutocompleteTree
