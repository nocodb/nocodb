// ref : https://medium.com/weekly-webtips/js-implementing-auto-complete-f4c5a5d5c009

interface Node {
  value: []
  isLeaf: boolean
  children: Record<string, Node>
}

export class NcAutocompleteTree {
  trie: Record<string, any>
  suggestions: Record<string, any>[]

  constructor() {
    this.trie = {}
    this.suggestions = []
  }

  newNode(): Node {
    return {
      value: [],
      isLeaf: false,
      children: {},
    }
  }

  add(word: Record<string, any>) {
    if (Object.keys(this.trie).length === 0) {
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
    root.isLeaf = true
  }

  find(word: string) {
    if (Object.keys(this.trie).length === 0) {
      this.trie = this.newNode()
    }
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

  traverse(root: Node) {
    if (root.isLeaf) {
      this.suggestions.push(...root.value)
    }

    for (const letter in root.children) {
      this.traverse(root.children[letter])
    }
  }

  complete(word: string, CHILDREN = null) {
    this.suggestions = []
    const root = this.find(word.toLowerCase())

    if (!root || Object.keys(root).length === 0) {
      return this.suggestions
    } // cannot suggest anything

    this.suggestions.push(...root.value)

    const children = root.children

    let spread = 0
    for (const letter in children) {
      this.traverse(children[letter])
      spread++

      if (CHILDREN && spread === CHILDREN) {
        break
      }
    }

    return this.suggestions
  }
}
